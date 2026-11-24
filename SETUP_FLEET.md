# Freqtrade 3-bot fleet — Setup Guide

This guide gets a 3-bot freqtrade fleet, a unified dashboard, and
optional AI layers (OpenClaw / OpenAlice) running on this machine
using **Podman** or **Docker**.

> Strategies, configs, compose file and dashboard choice all come from
> the trends extracted out of `history_discord/` (Apr 2026 snapshots).

---

## 1. Fleet at a glance

| # | Container | Strategy | Role | Capital | Port (host) |
|---|-----------|----------|------|---------|-------------|
| 1 | `ft-nexusforge` | `AlexNexusForgeV8AIV7` | FreqAI alpha-engine, top dry-run performer | ~50 % | `9020` |
| 2 | `ft-ecrv32`     | `ECRV32`               | DCA/martingale, ~75 % winrate              | ~30 % | `9060` |
| 3 | `ft-bandsniper` | `AlexBandSniperV654`   | Conservative high-WR sniper                | ~20 % | `9050` |
| – | `frequi`        | —                      | Official multi-bot dashboard               | —     | `8500` |

All three trade **Bybit USDT-M futures, 15m timeframe, isolated margin**,
shared `user_data/data/` for OHLCV (Alex's pattern from the discord).

---

## 2. Files in this repo

| Path | Purpose |
|------|---------|
| [docker-compose.fleet.yml](docker-compose.fleet.yml) | 3 freqtrade services + FreqUI dashboard |
| [user_data/configs/config_base.json](user_data/configs/config_base.json) | Reference / shared base settings |
| [user_data/configs/config_bot1_nexusforge.json](user_data/configs/config_bot1_nexusforge.json) | Bot 1 config (FreqAI on) |
| [user_data/configs/config_bot2_ecrv32.json](user_data/configs/config_bot2_ecrv32.json) | Bot 2 config (DCA / position adjustment on) |
| [user_data/configs/config_bot3_bandsniper.json](user_data/configs/config_bot3_bandsniper.json) | Bot 3 config (conservative) |
| [user_data/strategies/README.md](user_data/strategies/README.md) | Where to drop the `.py` files |

---

## 3. Step-by-step

### 3.1 Get the strategy files

The PRO/VIP `.py` files are **not** in this repo. Open Discord,
go to `Alex Crypto King`, and download these attachments to
[user_data/strategies/](user_data/strategies/):

- `AlexNexusForgeV8AIV7.py` — channel `🚀alexnexusforge`
- `ECRV32.py` — channel `🎯alexecr` (or fall back to `ECRV31.py`)
- `AlexBandSniperV654.py` — channel `🎯alexbandsniper`

Original message references are in
[history_discord/](history_discord/) (look for the `.py` attachment URLs).

### 3.2 Configure secrets

Edit each `user_data/configs/config_bot*.json` and replace every
`REPLACE_ME` / `CHANGE_ME*` with real values:

- `exchange.key`, `exchange.secret` — Bybit API keys (start in
  *read-only* mode while `dry_run: true`)
- `api_server.jwt_secret_key`, `api_server.ws_token` — random
  strings (`openssl rand -hex 32`)
- `api_server.password` — the password you'll use in FreqUI
- (optional) `telegram.token` / `chat_id`

> Keep `dry_run: true` for at least 2 weeks. Live ≠ dry-run is
> the #1 reported pain point in the discord (`AlexNinjaV9` etc.).

### 3.3 Download market data once (shared by all 3 bots)

```bash
podman run --rm -v "$PWD/user_data:/freqtrade/user_data" \
    freqtradeorg/freqtrade:stable \
    download-data \
    --exchange bybit \
    --trading-mode futures \
    --timeframes 15m 1h 4h \
    --timerange 20250101- \
    --config /freqtrade/user_data/configs/config_bot1_nexusforge.json
```

### 3.4 Start the fleet

```bash
podman compose -f docker-compose.fleet.yml up -d
# or:  docker compose -f docker-compose.fleet.yml up -d
```

Check health:

```bash
podman ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
podman logs -f ft-nexusforge
```

### 3.5 Open the dashboard

Browse to <http://localhost:8500> and add the 3 bots:

| Name        | URL                            | User        | Password     |
|-------------|--------------------------------|-------------|--------------|
| nexusforge  | `http://ft-nexusforge:8080`    | `freqtrade` | (yours)      |
| ecrv32      | `http://ft-ecrv32:8080`        | `freqtrade` | (yours)      |
| bandsniper  | `http://ft-bandsniper:8080`    | `freqtrade` | (yours)      |

> `FreqUI` (official, free, MIT) is recommended over the
> community `AlexFreqAlphaDashboard` for a clean first install —
> the Alex dashboard adds nice extras (auto-discovery, finviz
> screener, drawdown alerts) but is shipped as a `.rar` in
> Discord and the CDN link from `history_discord/` is expired.
> Once you want it, grab a fresh `.rar` from
> `🤖alexfreqalphadeck-dashboard`, unpack, point its
> *Discovery Settings* at `host_ip:9020 / 9060 / 9050`.

### 3.6 Hyperopt (optional, recommended monthly)

Each strategy normally ships with a `*_Hyper.py` twin. Run:

```bash
podman run --rm -v "$PWD/user_data:/freqtrade/user_data" \
    freqtradeorg/freqtrade:stable \
    hyperopt \
    --hyperopt-loss SharpeHyperOptLossDaily \
    --spaces buy sell stoploss \
    --strategy AlexNexusForgeV8AIV7Hyper \
    --config /freqtrade/user_data/configs/config_bot1_nexusforge.json \
    --timerange 20250601-20251201 \
    -e 1000
```

Then copy the produced `*_Hyper.json` over the live `.json`
parameter file and reload the bot
(`podman restart ft-nexusforge`). This is the canonical Alex
workflow from the pinned `🐳installation` channel.

---

## 4. Operational notes from the discord

- **Bybit leverage error** ("no leverage tiers"): don't remove
  pairs — `pip install -U ccxt` then delete `user_data/data/bybit/leverage_*.json`,
  they will be repopulated.
- **DCA + leverage = liquidation risk.** ECR with stoploss `-0.12`
  becomes `-120 %` at 10×. Cap leverage at 5× via the strategy's
  `leverage()` method (see template in `🎯alexecr` channel,
  29 Apr 2026 message).
- **All bots on same host?** Use Docker bridge with the named
  network in the compose file — bots reach each other by service
  name (`ft-ecrv32:8080`). For *cross-host* discovery, bind the
  port on the host and use `host_ip:port` instead of the
  internal `172.17.x.x` address.
- **OHLCV data folder** is shared across all 3 bots
  (`./user_data/data`). Saves bandwidth, prevents drift.

---

## 5. Optional AI layer — OpenClaw

OpenClaw is the AI workflow Alex actively recommends today
(it's already shipping, unlike HATE v3).

```bash
# Install per official docs (cleanest path):
# https://docs.openclaw.ai/install
```

Pair it with a Claude Pro subscription and point it at this
repo's `user_data/strategies/` for code-aware strategy iteration.

---

## 6. Optional AI layer — OpenAlice (experimental)

OpenAlice is a *separate* TypeScript trading agent, not a
freqtrade plugin. Run it on the **same machine** as a
research/oversight layer; let freqtrade keep doing the
execution.

```bash
# Prerequisites: Node.js 22+, pnpm 10+, Claude Code CLI authed.
git clone https://github.com/TraderAlice/OpenAlice.git
cd OpenAlice
pnpm install && pnpm build
pnpm dev
# UI: http://localhost:3002
```

Configure under `data/config/`:

- `accounts.json` — add a UTA (Unified Trading Account) of
  `type: "ccxt"` pointing at Bybit; mirror the same pair
  whitelist as your freqtrade configs.
- `agent.json` — keep **Evolution mode = false** until trusted
  (it grants Claude full Bash on the host).
- `ai-provider.json` — `agent-sdk` (uses your Claude Pro login,
  no API key) or switch to `vercel-ai-sdk` for OpenAI/Gemini.

Workflow: stage → commit → **push (you approve)** → broker.
Treat it as **paper / read-only** until you've watched it for a
few weeks. Per upstream README: *experimental, do not use with
real funds without understanding the risks*.

---

## 7. About HATE v3

Announced in `📜DISCUSS Q & A _ feature-updates` on
**31 Oct 2025** by `themarkx_` — design only, **no code
released through 29 Apr 2026**. Planned shape:
`user_data/ai_engine/` Python package with 5 layers
(Performance Loop / Analysts / Manager / Trader / Oversight),
strategy file becomes a thin loader.

**Recommendation:** don't wait for HATE v3 to start trading. Use
the OpenClaw + freqtrade combo today; revisit HATE v3 when a
repo is published.

---

## 8. Troubleshooting cheat sheet

| Symptom | Fix |
|---------|-----|
| `Strategy XYZ not found` | Class name in `.py` must equal value passed to `--strategy`; check casing. |
| `No leverage tiers for pair` | Update ccxt, delete `user_data/data/bybit/leverage_*.json`. |
| FreqUI says *401 Unauthorized* | Password mismatch with `api_server.password`. |
| Bot stuck *open* on Bybit after exchange-side close | Known Bybit/freqtrade issue (see `troubleshooting-bugs` 27 Oct 2025). Verify Bybit server time sync; consider `stoploss_on_exchange: true`. |
| Backtest profitable, live losing | Don't disable stoploss. Use protections, smaller stake, longer dry-run. |
