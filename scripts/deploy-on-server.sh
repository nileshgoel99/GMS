#!/usr/bin/env bash
# Run on the **production server** (no SSH). After git push, from /var/www/gms:
#   ./scripts/deploy-on-server.sh
# Or:
#   bash scripts/deploy-on-server.sh
#
# Optional (defaults are fine for gms.nileshgoel.in):
#   DEPLOY_PATH=/var/www/gms REACT_API_URL=https://gms.nileshgoel.in/api ./scripts/deploy-on-server.sh
#
set -euo pipefail

# When run via `ssh ... bash -s < file`, $0 is not the script path — resolve root via env, git, or default.
if [[ -z "${DEPLOY_PATH:-}" ]]; then
  if [[ $(git rev-parse --is-inside-work-tree 2>/dev/null) == true ]]; then
    DEPLOY_PATH=$(git rev-parse --show-toplevel)
  else
    DEPLOY_PATH="/var/www/gms"
  fi
fi
REACT_API_URL="${REACT_API_URL:-${REACT_API:-https://gms.nileshgoel.in/api}}"

echo "==> GMS deploy (on-server, no SSH)"
echo "    DEPLOY_PATH=${DEPLOY_PATH}"
echo "    REACT_APP_API_URL=${REACT_API_URL}"

if [[ ! -d "$DEPLOY_PATH/.git" ]]; then
  echo "Error: not a git repo: $DEPLOY_PATH" >&2
  exit 1
fi

cd "$DEPLOY_PATH"
echo "==> git pull (ff-only)..."
git pull --ff-only

cd "$DEPLOY_PATH/backend"
if [[ ! -d venv ]]; then
  echo "==> creating Python venv..."
  python3 -m venv venv
fi
# shellcheck source=/dev/null
source venv/bin/activate
echo "==> pip install..."
pip install -q --upgrade pip
pip install -q -r requirements.txt

echo "==> django migrate + collectstatic..."
python manage.py migrate --noinput
python manage.py collectstatic --noinput

cd "$DEPLOY_PATH/frontend"
if [[ -f package-lock.json ]]; then
  if ! npm ci 2>/dev/null; then
    echo "==> npm ci failed, falling back to npm install (commit lockfile from dev)..." >&2
    npm install
  fi
else
  npm install
fi
echo "==> production build (CRA)..."
REACT_APP_API_URL="$REACT_API_URL" npm run build

echo "==> restart services..."
if systemctl is-active gms &>/dev/null; then
  systemctl restart gms
else
  echo "==> warn: gms.service is not active (systemctl enable --now gms)" >&2
fi
systemctl reload nginx

echo ""
echo "==> OK — deployment finished."
