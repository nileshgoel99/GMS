#!/usr/bin/env bash
# Deploy GMS to production after: git add / commit / push
#
# Usage (from your machine, after pushing to the default branch):
#   chmod +x scripts/deploy.sh   # once
#   ./scripts/deploy.sh
#
# Optional (defaults match current production):
#   DEPLOY_HOST=root@159.65.146.167 \
#   DEPLOY_PATH=/var/www/gms \
#   API_PUBLIC_URL=https://gms.nileshgoel.in/api \
#   ./scripts/deploy.sh
#
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-root@159.65.146.167}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/gms}"
API_PUBLIC_URL="${API_PUBLIC_URL:-https://gms.nileshgoel.in/api}"

echo "==> Deploying to ${DEPLOY_HOST} (${DEPLOY_PATH})"
echo "    REACT_APP_API_URL=${API_PUBLIC_URL}"

# Values from this shell are expanded into the remote script (paths must not contain ' )
ssh -o BatchMode=yes -o ConnectTimeout=15 "${DEPLOY_HOST}" bash -s <<EOF
set -euo pipefail
APP_PATH='${DEPLOY_PATH}'
REACT_API='${API_PUBLIC_URL}'

if [[ ! -d "\$APP_PATH/.git" ]]; then
  echo "Error: not a git repo: \$APP_PATH" >&2
  exit 1
fi

cd "\$APP_PATH"
echo "==> git pull (ff-only)..."
git pull --ff-only

cd "\$APP_PATH/backend"
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

cd "\$APP_PATH/frontend"
if [[ -f package-lock.json ]]; then
  if ! npm ci 2>/dev/null; then
    echo "==> npm ci failed, falling back to npm install (run npm install in frontend/ and commit lockfile)..." >&2
    npm install
  fi
else
  npm install
fi
echo "==> production build (CRA)..."
REACT_APP_API_URL="\$REACT_API" npm run build

echo "==> restart services..."
if systemctl is-active gms &>/dev/null; then
  systemctl restart gms
else
  echo "==> warn: gms.service is not active (start it once: systemctl enable --now gms)" >&2
fi
systemctl reload nginx

echo ""
echo "==> OK — deployment finished."
EOF
