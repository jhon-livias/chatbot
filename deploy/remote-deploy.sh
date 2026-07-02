#!/usr/bin/env bash
# remote-deploy.sh — Full production deploy (run on VPS).
set -euo pipefail

cd /opt/chatbot-uprit

if [[ ! -f .env ]]; then
  echo "Error: .env not found" >&2
  exit 1
fi

echo "==> git pull"
git pull --ff-only origin main

echo "==> docker compose build app"
docker compose build app

echo "==> docker compose up -d"
docker compose up -d

echo "==> reload apache (if active)"
if systemctl is-active --quiet apache2; then
  sudo apachectl configtest
  sudo systemctl reload apache2
fi

sleep 3

echo "==> audit secrets"
bash deploy/audit-meta-secrets.sh

echo "==> check meta token"
bash deploy/check-meta-token.sh

echo "==> verify webhook GET"
bash deploy/verify-webhook.sh test123

API_PORT="$(grep -E '^API_PORT=' .env | cut -d= -f2- | tr -d '[:space:]' || true)"
API_PORT="${API_PORT:-8090}"

echo "==> health http://127.0.0.1:${API_PORT}/health"
curl -fsS "http://127.0.0.1:${API_PORT}/health"
echo

echo "==> public health"
curl -fsS "https://chatbot.uprit.edu.pe/health"
echo

docker compose ps app grafana

echo "==> Deploy finished OK"
