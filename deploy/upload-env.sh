#!/usr/bin/env bash
#
# upload-env.sh — Copy local .env to EC2 (one-time / when secrets change).
# Usage: ./deploy/upload-env.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PEM_FILE="${REPO_ROOT}/vps/RepositoryMagazine.pem"
ENV_FILE="${REPO_ROOT}/.env"
EC2_HOST="${EC2_HOST:-ec2-13-217-220-99.compute-1.amazonaws.com}"
SSH_USER="${SSH_USER:-ubuntu}"
REMOTE_DIR="${REMOTE_DIR:-/opt/chatbot-uprit}"

if [[ ! -f "${PEM_FILE}" ]]; then
  echo "Error: PEM not found at ${PEM_FILE}" >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Error: .env not found at ${ENV_FILE}" >&2
  exit 1
fi

chmod 400 "${PEM_FILE}"

echo "==> Uploading .env to ${SSH_USER}@${EC2_HOST}:${REMOTE_DIR}/.env"
scp -i "${PEM_FILE}" -o ConnectTimeout=20 "${ENV_FILE}" "${SSH_USER}@${EC2_HOST}:${REMOTE_DIR}/.env"

echo "==> Restarting app container"
ssh -i "${PEM_FILE}" -o ConnectTimeout=20 "${SSH_USER}@${EC2_HOST}" \
  "cd ${REMOTE_DIR} && docker compose up -d app && sleep 3 && curl -fsS http://127.0.0.1:8080/health"

echo "==> Done"
