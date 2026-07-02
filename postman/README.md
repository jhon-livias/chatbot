# Postman — Chatbot UPRIT

Producción: **https://chatbot.uprit.edu.pe**

## Importar

1. `postman/chatbot-uprit.postman_collection.json`
2. Environment (elige uno):
   - **Recomendado:** generar desde el VPS (valores reales, no se commitea):
     ```bash
     ./vps/connect.sh "bash /opt/chatbot-uprit/deploy/generate-postman-env.sh" > postman/chatbot-uprit.postman_environment.local.json
     ```
     Importa `chatbot-uprit.postman_environment.local.json` en Postman.
   - **Plantilla vacía:** `postman/chatbot-uprit.postman_environment.json` (rellena a mano)

Activa el environment en la esquina superior derecha de Postman.

## Secrets — NO son lo mismo

| Postman | `.env` del VPS | Qué es | Dónde obtenerlo en Meta |
| ------- | -------------- | ------ | ------------------------ |
| `meta_webhook_verify_token` | `META_WEBHOOK_VERIFY_TOKEN` | Token de verificación (GET) | WhatsApp → Webhook → **Verify token** (lo defines tú) |
| `webhook_secret` | `WEBHOOK_SECRET` | **App Secret** (POST, firma HMAC) | App → Configuración → Básica → **Clave secreta** (32 hex) |

```
GET  /webhook  →  meta_webhook_verify_token
POST /webhook  →  webhook_secret (= App Secret)
```

## Requests

| Request | Resultado esperado |
| ------- | ------------------ |
| GET /health | `200` `{ "status": "ok" }` |
| GET /webhook — Meta verification | `200` + body = `test123` |
| GET /webhook — Invalid token | `403` |
| POST /webhook — Invalid signature | `403` |
| POST /webhook — Text message | `200` + respuesta en WhatsApp |
| POST /webhook — Status update | `200` (evento ignorado) |

## Orden de prueba

1. GET /health
2. GET /webhook — Meta verification
3. POST /webhook — Invalid signature
4. POST /webhook — Text message (número real en `test_wa_id`)

## Sincronizar tras cambiar `.env` en el VPS

```bash
# Regenerar environment de Postman
./vps/connect.sh "bash /opt/chatbot-uprit/deploy/generate-postman-env.sh" > postman/chatbot-uprit.postman_environment.local.json

# Validar secrets en el servidor
./vps/connect.sh "cd /opt/chatbot-uprit && bash deploy/audit-meta-secrets.sh && docker compose up -d app"
```

## Grafana

**https://grafana.uprit.edu.pe** → Explore → Loki:

```logql
{container="chatbot-uprit-app"} |= "WhatsApp"
```
