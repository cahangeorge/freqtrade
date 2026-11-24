#!/usr/bin/env bash
set -euo pipefail

# Freqtrade Dashboard - setup/deploy helper
# =======================================
# - Keeps source-of-truth in workspace
# - Deploys to /opt/Multi_Dashboard
# - Optionally installs Docker
# - Optionally does a fresh start (wipes volumes)

PROJECT_SRC="/root/.openclaw/workspace/Projects/freqtrade-dashboard-fixed"
DEPLOY_DIR_DEFAULT="/opt/Multi_Dashboard"

usage() {
  cat <<'EOF'
Usage: ./setup.sh [--deploy-dir /opt/Multi_Dashboard] [--public-host IP] [--admin-user admin] [--admin-pass PASS] [--jwt-secret HEX] [--install-docker] [--fresh]

Options:
  --deploy-dir       Where to deploy the project (default: /opt/Multi_Dashboard)
  --public-host      IP/DNS you use in the browser (default: auto-detect)
  --admin-user       Dashboard admin username (default: admin)
  --admin-pass       Dashboard admin password (default: admin12)
  --jwt-secret       JWT secret hex string (default: random 32 bytes)
  --install-docker   Install Docker engine if missing (uses get.docker.com)
  --fresh            DANGEROUS: docker compose down -v (wipes dashboard DB)

Examples:
  ./setup.sh --public-host 192.168.0.210 --admin-pass 'Admin123!'
  ./setup.sh --install-docker --fresh
EOF
}

DEPLOY_DIR="$DEPLOY_DIR_DEFAULT"
PUBLIC_HOST=""
ADMIN_USER="admin"
ADMIN_PASS="admin12"
JWT_SECRET=""
INSTALL_DOCKER="0"
FRESH="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --deploy-dir) DEPLOY_DIR="$2"; shift 2 ;;
    --public-host) PUBLIC_HOST="$2"; shift 2 ;;
    --admin-user) ADMIN_USER="$2"; shift 2 ;;
    --admin-pass) ADMIN_PASS="$2"; shift 2 ;;
    --jwt-secret) JWT_SECRET="$2"; shift 2 ;;
    --install-docker) INSTALL_DOCKER="1"; shift 1 ;;
    --fresh) FRESH="1"; shift 1 ;;
    *) echo "Unknown arg: $1"; usage; exit 1 ;;
  esac
done

if [[ -z "$PUBLIC_HOST" ]]; then
  # take first non-loopback IPv4
  PUBLIC_HOST=$(ip -4 addr show | awk '/inet /{print $2}' | cut -d/ -f1 | grep -v '^127\.' | head -n1 || true)
fi

if [[ -z "$PUBLIC_HOST" ]]; then
  echo "ERROR: Could not auto-detect PUBLIC_HOST. Please pass --public-host <ip>" >&2
  exit 1
fi

if [[ -z "$JWT_SECRET" ]]; then
  JWT_SECRET=$(openssl rand -hex 32)
fi

# bcrypt has a 72-byte limit
if (( ${#ADMIN_PASS} > 72 )); then
  echo "ERROR: admin password is > 72 chars. bcrypt limit. Use shorter password." >&2
  exit 1
fi

need_cmd() { command -v "$1" >/dev/null 2>&1; }

if ! need_cmd docker; then
  if [[ "$INSTALL_DOCKER" == "1" ]]; then
    echo "Installing Docker via get.docker.com ..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker || true
  else
    echo "ERROR: docker not found. Install Docker or re-run with --install-docker" >&2
    exit 1
  fi
fi

# Prefer docker compose v2, fallback to docker-compose
COMPOSE=""
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif need_cmd docker-compose; then
  COMPOSE="docker-compose"
else
  echo "ERROR: docker compose not available. Install docker-compose-plugin or docker-compose." >&2
  exit 1
fi

echo "Deploying from: $PROJECT_SRC"
echo "Deploying to:   $DEPLOY_DIR"

mkdir -p "$DEPLOY_DIR"
rsync -a --delete "$PROJECT_SRC/" "$DEPLOY_DIR/"

cd "$DEPLOY_DIR"

export DASHBOARD_ADMIN_USERNAME="$ADMIN_USER"
export DASHBOARD_ADMIN_PASSWORD="$ADMIN_PASS"
export JWT_SECRET="$JWT_SECRET"
export PUBLIC_HOST="$PUBLIC_HOST"

# Write .env for convenience
cat > .env <<EOF
DASHBOARD_ADMIN_USERNAME=$DASHBOARD_ADMIN_USERNAME
DASHBOARD_ADMIN_PASSWORD=$DASHBOARD_ADMIN_PASSWORD
JWT_SECRET=$JWT_SECRET
PUBLIC_HOST=$PUBLIC_HOST
EOF

echo "Environment written to $DEPLOY_DIR/.env"

if [[ "$FRESH" == "1" ]]; then
  echo "Fresh mode: stopping stack and removing volumes (wipes DB) ..."
  $COMPOSE down -v --remove-orphans || true
fi

echo "Building and starting stack ..."
$COMPOSE up -d --build

echo ""
echo "✅ Done. Open:  http://$PUBLIC_HOST:5000"
echo "   Backend:     http://$PUBLIC_HOST:8000/health"
echo "   Login:       $ADMIN_USER / (your password)"

echo ""
echo "Useful commands:"
echo "  cd $DEPLOY_DIR"
echo "  $COMPOSE ps"
echo "  $COMPOSE logs -n 120 backend"
