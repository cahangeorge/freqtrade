"""Discovery orchestrator combining Docker and filesystem discovery."""

from datetime import datetime
from typing import Optional
from uuid import uuid4

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.bot import Bot, BotEnvironment, HealthState, SourceMode
from src.services.discovery import DiscoveryResult
from src.services.discovery.docker import DockerDiscovery
from src.services.discovery.filesystem import FilesystemDiscovery
from src.services.websocket import ws_manager

logger = structlog.get_logger()


class DiscoveryOrchestrator:
    """Orchestrates bot discovery from multiple sources."""

    def __init__(self):
        """Initialize discovery orchestrator with all discovery sources."""
        self.docker_discovery = DockerDiscovery()
        self.filesystem_discovery = FilesystemDiscovery()
        self._last_scan: Optional[datetime] = None

    @property
    def last_scan(self) -> Optional[datetime]:
        """Get timestamp of last discovery scan."""
        return self._last_scan

    async def discover_all(self, db: AsyncSession) -> dict:
        """Run discovery across all sources and update database.

        Args:
            db: Database session for persisting results.

        Returns:
            Summary of discovery results.
        """
        logger.info("Starting discovery scan")
        self._last_scan = datetime.utcnow()

        all_results: list[DiscoveryResult] = []

        # Run Docker discovery
        if await self.docker_discovery.is_available():
            docker_results = await self.docker_discovery.discover()
            all_results.extend(docker_results)
            logger.info("Docker discovery found bots", count=len(docker_results))

        # Run filesystem discovery
        if await self.filesystem_discovery.is_available():
            fs_results = await self.filesystem_discovery.discover()
            all_results.extend(fs_results)
            logger.info("Filesystem discovery found bots", count=len(fs_results))

        # Process results and update database
        summary = await self._process_results(db, all_results)

        logger.info(
            "Discovery scan completed",
            discovered=summary["discovered"],
            new=summary["new"],
            updated=summary["updated"],
            removed=summary["removed"],
        )

        return summary

    async def _process_results(
        self, db: AsyncSession, results: list[DiscoveryResult]
    ) -> dict:
        """Process discovery results and sync with database.

        Args:
            db: Database session.
            results: List of discovery results.

        Returns:
            Summary dict with counts.
        """
        new_count = 0
        updated_count = 0

        # Get existing bots
        existing_bots = await db.execute(select(Bot))
        existing_map: dict[str, Bot] = {}
        url_map: dict[str, Bot] = {}  # Map by api_url for deduplication (same URL = same bot)

        for bot in existing_bots.scalars():
            # Create a unique key based on identifiers
            if bot.container_id:
                existing_map[f"docker:{bot.container_id}"] = bot
            elif bot.user_data_path:
                existing_map[f"fs:{bot.user_data_path}"] = bot
            # Map by api_url - this is the primary deduplication key
            # Same API URL means same bot, regardless of container name
            if bot.api_url:
                url_map[bot.api_url] = bot

        # Track which bots we've seen in this scan
        seen_keys: set[str] = set()

        # Process each discovery result
        for result in results:
            # Generate unique key
            if result.container_id:
                key = f"docker:{result.container_id}"
            elif result.user_data_path:
                key = f"fs:{result.user_data_path}"
            else:
                continue

            seen_keys.add(key)

            # Check by api_url first - this is the primary deduplication key
            # Same API URL = same bot, even if container name changed
            existing_by_url = url_map.get(result.api_url) if result.api_url else None

            if key in existing_map:
                # Update existing bot (matched by container_id)
                bot = existing_map[key]
                updated = self._update_bot_from_result(bot, result)
                if updated:
                    updated_count += 1
            elif existing_by_url:
                # Bot exists with same api_url but different container_id/name
                # This happens when container is renamed or recreated
                bot = existing_by_url
                old_name = bot.name
                old_container_id = bot.container_id
                bot.container_id = result.container_id
                bot.name = result.name  # Update name to match new container
                updated = self._update_bot_from_result(bot, result)
                # Update the existing_map with new key
                existing_map[key] = bot
                updated_count += 1
                logger.info(
                    "Updated bot matched by API URL",
                    old_name=old_name,
                    new_name=result.name,
                    api_url=result.api_url,
                    old_container_id=old_container_id,
                    new_container_id=result.container_id,
                )
            else:
                # Create new bot
                bot = self._create_bot_from_result(result)
                db.add(bot)
                new_count += 1

                # Broadcast new bot discovered via WebSocket
                await ws_manager.broadcast(
                    {
                        "type": "bot_discovered",
                        "bot_id": bot.id,
                        "data": {
                            "name": bot.name,
                            "environment": bot.environment.value,
                            "exchange": bot.exchange,
                            "strategy": bot.strategy,
                            "is_dryrun": bot.is_dryrun,
                        },
                        "timestamp": datetime.utcnow().isoformat(),
                    }
                )

        # Mark bots not seen as potentially unreachable
        # (We don't automatically remove them - they might be temporarily offline)
        removed_count = 0
        for key, bot in existing_map.items():
            if key not in seen_keys:
                # Bot not found in this scan
                if bot.health_state != HealthState.UNREACHABLE:
                    bot.health_state = HealthState.UNREACHABLE
                    removed_count += 1

                    # Broadcast bot offline via WebSocket
                    await ws_manager.broadcast(
                        {
                            "type": "bot_removed",
                            "bot_id": bot.id,
                            "data": {
                                "name": bot.name,
                                "reason": "not_found_in_scan",
                            },
                            "timestamp": datetime.utcnow().isoformat(),
                        }
                    )

        await db.commit()

        return {
            "discovered": len(results),
            "new": new_count,
            "updated": updated_count,
            "removed": removed_count,
        }

    def _create_bot_from_result(self, result: DiscoveryResult) -> Bot:
        """Create a new Bot model from discovery result.

        Args:
            result: Discovery result.

        Returns:
            New Bot instance.
        """
        environment = BotEnvironment(result.environment)

        # Determine initial source mode
        if result.api_available and result.sqlite_available:
            source_mode = SourceMode.AUTO
        elif result.api_available:
            source_mode = SourceMode.API
        elif result.sqlite_available:
            source_mode = SourceMode.SQLITE
        else:
            source_mode = SourceMode.AUTO

        # Determine initial health state - default to HEALTHY
        # Health monitor will update state based on actual connectivity
        if result.api_available:
            health_state = HealthState.HEALTHY
        elif result.sqlite_available:
            health_state = HealthState.HEALTHY  # SQLite available = bot is healthy
        else:
            health_state = HealthState.HEALTHY  # Default to healthy, let health monitor verify

        return Bot(
            id=str(uuid4()),
            name=result.name,
            environment=environment,
            host=result.host,
            container_id=result.container_id,
            user_data_path=result.user_data_path,
            api_url=result.api_url,
            api_port=result.api_port,
            source_mode=source_mode,
            health_state=health_state,
            exchange=result.exchange,
            strategy=result.strategy,
            is_dryrun=result.is_dryrun,
            tags=[],
            discovered_at=datetime.utcnow(),
            last_seen=datetime.utcnow() if result.api_available else None,
        )

    def _update_bot_from_result(self, bot: Bot, result: DiscoveryResult) -> bool:
        """Update existing bot from discovery result.

        Args:
            bot: Existing Bot model.
            result: Fresh discovery result.

        Returns:
            True if any field was updated.
        """
        updated = False

        # Update connection details
        if result.api_url and bot.api_url != result.api_url:
            bot.api_url = result.api_url
            bot.api_port = result.api_port
            updated = True

        if result.user_data_path and bot.user_data_path != result.user_data_path:
            bot.user_data_path = result.user_data_path
            updated = True

        # Update metadata if available
        if result.exchange and bot.exchange != result.exchange:
            bot.exchange = result.exchange
            updated = True

        if result.strategy and bot.strategy != result.strategy:
            bot.strategy = result.strategy
            updated = True

        # Update timestamp
        if result.api_available:
            bot.last_seen = datetime.utcnow()
            updated = True

        return updated

    async def get_status(self) -> dict:
        """Get current discovery service status.

        Returns:
            Status dict with enabled sources and last scan time.
        """
        from src.config import settings

        docker_available = await self.docker_discovery.is_available()
        fs_available = await self.filesystem_discovery.is_available()

        next_scan = None
        if self._last_scan:
            from datetime import timedelta
            next_scan = self._last_scan + timedelta(
                seconds=settings.discovery.interval_seconds
            )

        return {
            "docker_enabled": settings.discovery.docker.enabled,
            "docker_available": docker_available,
            "filesystem_enabled": settings.discovery.filesystem.enabled,
            "filesystem_available": fs_available,
            "last_scan": self._last_scan.isoformat() if self._last_scan else None,
            "scan_interval_seconds": settings.discovery.interval_seconds,
            "next_scan": next_scan.isoformat() if next_scan else None,
        }


# Singleton instance
discovery_orchestrator = DiscoveryOrchestrator()
