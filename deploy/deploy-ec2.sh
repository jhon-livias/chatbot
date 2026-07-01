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
PEM_FILE="${VPS_DIR}/RepositoryMagazine.pem"
EC2_HOST="${EC2_HOST:-ec2-13-217-220-99.compute-1.amazonaws.com}"
SSH_USER="${SSH_USER:-ubuntu}"
REMOTE_DIR="${REMOTE_DIR:-/opt/chatbot-uprit}"

if [[ ! -f "${PEM_FILE}" ]]; then
  echo "Error: PEM not found at ${PEM_FILE}" >&2
  exit 1
fi

chmod 400 "${PEM_FILE}"

SSH_OPTS=(
  -i "${PEM_FILE}"
  -o StrictHostKeyChecking=accept-new
  -o ConnectTimeout=20
)

echo "==> Deploying to ${SSH_USER}@${EC2_HOST}:${REMOTE_DIR}"

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
curl -fsS http://127.0.0.1:8080/health
echo
docker compose ps app
EOF

echo "==> Deploy finished"
