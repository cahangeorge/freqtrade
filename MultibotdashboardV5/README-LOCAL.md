# freqtrade-dashboard-local (no Docker)

This folder is a **local (non-docker) install** wrapper around the working dashboard code.

## Install
On the target machine (Debian/Ubuntu):

```bash
cd /root/.openclaw/workspace/Projects/freqtrade-dashboard-local
sudo chmod +x install_local.sh
sudo ./install_local.sh \
  --host-ip 192.168.0.210 \
  --db postgres \
  --admin-user admin \
  --admin-pass 'admin12'
```

## What it sets up
- Backend: systemd service `freqtrade-dashboard-backend` (FastAPI/uvicorn)
- DB: Postgres (default) or SQLite
- Frontend: `npm run build` and served by nginx on port 5000 (default)

## Useful commands
```bash
systemctl status freqtrade-dashboard-backend
journalctl -u freqtrade-dashboard-backend -n 200 --no-pager
curl -s http://127.0.0.1:8000/health
```
