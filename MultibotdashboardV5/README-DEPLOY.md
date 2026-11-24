# freqtrade-dashboard-work (deploy notes)

This is the "known-good" baseline folder.

## Deploy (clean)

```bash
# pick a deploy folder
rsync -a --delete /root/.openclaw/workspace/Projects/freqtrade-dashboard-work/ /opt/Multi_Dashboard_WORK/
cd /opt/Multi_Dashboard_WORK

# required env
export PUBLIC_HOST=192.168.0.210
export JWT_SECRET="$(openssl rand -hex 32)"

# admin user (created by alembic migration 002)
export DASHBOARD_ADMIN_USERNAME=admin
export DASHBOARD_ADMIN_PASSWORD='admin12'

# disable alerts (alerts table not deployed yet)
export DISABLE_ALERTS=true

# (optional) default Freqtrade API creds for bot REST calls
export DASHBOARD_API_DEFAULTS__USERNAME='YOUR_FT_API_USER'
export DASHBOARD_API_DEFAULTS__PASSWORD='YOUR_FT_API_PASS'

# full reset
docker compose down -v --remove-orphans
docker compose up -d --build

docker compose logs -n 80 backend
```

UI: http://$PUBLIC_HOST:5000
API health: http://$PUBLIC_HOST:8000/health

## Notes
- CORS origins are configured in `config/dashboard.yaml` (this is why mobile works).
- The backend container now runs `alembic upgrade head` on startup.
