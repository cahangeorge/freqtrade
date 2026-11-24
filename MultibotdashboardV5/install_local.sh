#!/usr/bin/env bash
set -euo pipefail

# freqtrade-dashboard-local installer (no Docker)
# Target: Debian/Ubuntu

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

DEFAULT_HOST_IP="192.168.0.210"

usage() {
  cat <<'EOF'
Usage: sudo ./install_local.sh [options]

Options:
  --host-ip <ip>          Host/IP used by browsers (default: 192.168.0.210)
  --backend-port <port>   Backend port (default: 8000)
  --frontend-port <port>  Frontend port via nginx (default: 5000)
  --db <postgres|sqlite>  Database backend (default: postgres)
  --admin-user <user>     Admin username (default: admin)
  --admin-pass <pass>     Admin password (default: admin12)
  --jwt-secret <hex>      JWT secret (default: random)
  --ft-user <user>        Default Freqtrade API username (optional)
  --ft-pass <pass>        Default Freqtrade API password (optional)
  --skip-nginx            Do not install/configure nginx (serve frontend manually)

This script:
  - installs system deps
  - sets up Postgres (optional)
  - creates a python venv for backend and installs requirements
  - runs alembic migrations and seeds admin user
  - installs/builds frontend and serves it via nginx
  - creates systemd service for backend (freqtrade-dashboard-backend)

EOF
}

HOST_IP="$DEFAULT_HOST_IP"
BACKEND_PORT=8000
FRONTEND_PORT=5000
DB_KIND="postgres"
ADMIN_USER="admin"
ADMIN_PASS="admin12"
JWT_SECRET=""
FT_USER=""
FT_PASS=""
SKIP_NGINX=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --host-ip) HOST_IP="$2"; shift 2 ;;
    --backend-port) BACKEND_PORT="$2"; shift 2 ;;
    --frontend-port) FRONTEND_PORT="$2"; shift 2 ;;
    --db) DB_KIND="$2"; shift 2 ;;
    --admin-user) ADMIN_USER="$2"; shift 2 ;;
    --admin-pass) ADMIN_PASS="$2"; shift 2 ;;
    --jwt-secret) JWT_SECRET="$2"; shift 2 ;;
    --ft-user) FT_USER="$2"; shift 2 ;;
    --ft-pass) FT_PASS="$2"; shift 2 ;;
    --skip-nginx) SKIP_NGINX=1; shift 1 ;;
    *) echo "Unknown arg: $1"; usage; exit 1 ;;
  esac
done

if [[ -z "$JWT_SECRET" ]]; then
  JWT_SECRET=$(openssl rand -hex 32)
fi

if (( ${#ADMIN_PASS} > 72 )); then
  echo "ERROR: admin password > 72 chars (bcrypt limit)." >&2
  exit 1
fi

if [[ "$DB_KIND" != "postgres" && "$DB_KIND" != "sqlite" ]]; then
  echo "ERROR: --db must be postgres or sqlite" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

echo "== Installing system dependencies =="
apt-get update
apt-get install -y --no-install-recommends \
  ca-certificates curl git jq \
  python3 python3-venv python3-pip \
  nodejs npm \
  build-essential \
  nginx \
  || true

# Ensure recent node on Debian can be old; leave as-is for now.

DB_URL=""
if [[ "$DB_KIND" == "postgres" ]]; then
  echo "== Installing/Configuring Postgres =="
  apt-get install -y --no-install-recommends postgresql postgresql-contrib
  systemctl enable --now postgresql

  # Create DB/user if not exist
  sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='dashboard'" | grep -q 1 || sudo -u postgres psql -c "CREATE USER dashboard WITH PASSWORD 'dashboard';"
  sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='dashboard'" | grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE dashboard OWNER dashboard;"
  sudo -u postgres psql -d dashboard -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;" || true

  DB_URL="postgresql://dashboard:dashboard@127.0.0.1:5432/dashboard"
else
  echo "== Using SQLite database =="
  mkdir -p /var/lib/freqtrade-dashboard
  DB_URL="sqlite+aiosqlite:////var/lib/freqtrade-dashboard/dashboard.sqlite"
fi

echo "== Backend: venv + deps =="
mkdir -p /opt/freqtrade-dashboard
cp -a "$PROJECT_DIR" /opt/freqtrade-dashboard/app

BACKEND_DST="/opt/freqtrade-dashboard/app/backend"
FRONTEND_DST="/opt/freqtrade-dashboard/app/frontend"

python3 -m venv /opt/freqtrade-dashboard/venv
/opt/freqtrade-dashboard/venv/bin/pip install --upgrade pip
/opt/freqtrade-dashboard/venv/bin/pip install -r "$BACKEND_DST/requirements.txt"

echo "== Backend config (dashboard.yaml) =="
mkdir -p /opt/freqtrade-dashboard/config
cat > /opt/freqtrade-dashboard/config/dashboard.yaml <<EOF
server:
  host: "0.0.0.0"
  port: $BACKEND_PORT
  cors_origins:
    - "http://$HOST_IP:$FRONTEND_PORT"
    - "http://localhost:$FRONTEND_PORT"
    - "http://127.0.0.1:$FRONTEND_PORT"

api_defaults:
  timeout_seconds: 5
  username: "${FT_USER:-user}"
  password: "${FT_PASS:-pass}"

auth:
  jwt_secret: "${JWT_SECRET}"

logging:
  level: "INFO"
  format: "json"
EOF

echo "== Alembic migrations + seed admin =="
export DATABASE_URL="$DB_URL"
export JWT_SECRET="$JWT_SECRET"
export DASHBOARD_ADMIN_USERNAME="$ADMIN_USER"
export DASHBOARD_ADMIN_PASSWORD="$ADMIN_PASS"
export DISABLE_ALERTS=true

pushd "$BACKEND_DST" >/dev/null
/opt/freqtrade-dashboard/venv/bin/alembic upgrade head
popd >/dev/null

echo "== systemd service (backend) =="
cat > /etc/systemd/system/freqtrade-dashboard-backend.service <<EOF
[Unit]
Description=Freqtrade Dashboard Backend (FastAPI)
After=network.target

[Service]
Type=simple
WorkingDirectory=$BACKEND_DST
Environment=DATABASE_URL=$DB_URL
Environment=JWT_SECRET=$JWT_SECRET
Environment=DASHBOARD_ADMIN_USERNAME=$ADMIN_USER
Environment=DASHBOARD_ADMIN_PASSWORD=$ADMIN_PASS
Environment=DISABLE_ALERTS=true
ExecStart=/opt/freqtrade-dashboard/venv/bin/uvicorn src.main:app --host 0.0.0.0 --port $BACKEND_PORT
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now freqtrade-dashboard-backend

if [[ "$SKIP_NGINX" -eq 0 ]]; then
  echo "== Frontend build + nginx =="
  pushd "$FRONTEND_DST" >/dev/null
  npm ci
  # Build uses VITE_* at build time
  VITE_API_URL="http://$HOST_IP:$BACKEND_PORT/api/v1" \
  VITE_WS_URL="ws://$HOST_IP:$BACKEND_PORT/api/v1/ws" \
  npm run build
  popd >/dev/null

  rm -f /etc/nginx/sites-enabled/default || true
  cat > /etc/nginx/sites-available/freqtrade-dashboard.conf <<EOF
server {
  listen $FRONTEND_PORT;
  server_name _;

  root $FRONTEND_DST/dist;
  index index.html;

  location / {
    try_files \$uri \$uri/ /index.html;
  }
}
EOF

  ln -sf /etc/nginx/sites-available/freqtrade-dashboard.conf /etc/nginx/sites-enabled/freqtrade-dashboard.conf
  nginx -t
  systemctl enable --now nginx
  systemctl reload nginx
else
  echo "== Skipping nginx. You can run the frontend manually:"
  echo "  cd $FRONTEND_DST && npm ci && VITE_API_URL=... npm run dev -- --host 0.0.0.0 --port $FRONTEND_PORT"
fi

echo ""
echo "✅ Local install complete"
echo "UI:      http://$HOST_IP:$FRONTEND_PORT"
echo "Backend:  http://$HOST_IP:$BACKEND_PORT/health"
echo "Service:  systemctl status freqtrade-dashboard-backend"
