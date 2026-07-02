#!/usr/bin/env bash
#
# deploy-ec2.sh — Pull latest code and restart the chatbot on EC2.
# Run from your local machine:
#   ./deploy/deploy-ec2.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
VPS_DIR="${REPO_ROOT}/vps"
# shellcheck source=ec2-profile.sh
source "${SCRIPT_DIR}/ec2-profile.sh"
ec2_profile_resolve "${VPS_DIR}"
ec2_profile_ssh_opts

echo "==> Deploying (${VPS_PROFILE}) to ${SSH_USER}@${EC2_HOST}:${REMOTE_DIR}"

ssh "${SSH_OPTS[@]}" "${SSH_USER}@${EC2_HOST}" bash -s <<EOF
set -euo pipefail
cd "${REMOTE_DIR}"

if [[ ! -f .env ]]; then
  echo "Error: ${REMOTE_DIR}/.env not found. Create it before deploying." >&2
  exit 1
fi

echo "==> git pull"
git pull --ff-only origin main

echo "==> docker compose build app"
docker compose build app

echo "==> docker compose up -d app"
docker compose up -d app

echo "==> nginx test + reload"
if command -v nginx >/dev/null 2>&1; then
  sudo nginx -t
  sudo systemctl reload nginx
fi

echo "==> health check"
sleep 3
API_PORT="\$(grep -E '^API_PORT=' .env | cut -d= -f2- | tr -d '[:space:]' || true)"
API_PORT="\${API_PORT:-8090}"
curl -fsS "http://127.0.0.1:\${API_PORT}/health"
echo
docker compose ps app
EOF

echo "==> Deploy finished"
