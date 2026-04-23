#!/usr/bin/env bash
# Deploy GMS: run this from your **laptop** (where SSH keys work for the server).
# It runs the same steps as `deploy-on-server.sh` over SSH.
#
#   ./scripts/deploy.sh
#
# If you are **already on the server**, do not use SSH; run on the server instead:
#   cd /var/www/gms && ./scripts/deploy-on-server.sh
#
# Optional:
#   DEPLOY_HOST=root@ip DEPLOY_PATH=/var/www/gms API_PUBLIC_URL=https://gms.../api ./scripts/deploy.sh
#
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-root@159.65.146.167}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/gms}"
API_PUBLIC_URL="${API_PUBLIC_URL:-https://gms.nileshgoel.in/api}"

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
DSS="${SCRIPT_DIR}/deploy-on-server.sh"
if [[ ! -f "$DSS" ]]; then
  echo "Missing $DSS" >&2
  exit 1
fi

echo "==> Remote deploy via ${DEPLOY_HOST} (${DEPLOY_PATH})"
echo "    (from laptop only — on the server, use: ./scripts/deploy-on-server.sh)"
echo "    REACT_APP_API_URL=${API_PUBLIC_URL}"

# Pipe script into remote bash; env avoids \$0/dirname issues with stdin
ssh -o BatchMode=yes -o ConnectTimeout=15 "${DEPLOY_HOST}" \
  env "DEPLOY_PATH=${DEPLOY_PATH}" "REACT_API_URL=${API_PUBLIC_URL}" bash -s < "$DSS"
