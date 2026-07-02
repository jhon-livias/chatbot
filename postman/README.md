# Postman — Chatbot UPRIT

Producción: **https://chatbot.uprit.edu.pe**

## Importar en Postman

1. `postman/chatbot-uprit.postman_collection.json`
2. `postman/chatbot-uprit.postman_environment.json`

En Postman: **Import** → arrastra ambos archivos → activa el environment **Chatbot UPRIT — chatbot.uprit.edu.pe**.

## Configurar secrets

Edita el environment con los valores del `.env` del servidor:

| Variable Postman | Variable `.env` |
| ---------------- | --------------- |
| `meta_webhook_verify_token` | `META_WEBHOOK_VERIFY_TOKEN` |
| `webhook_secret` | `WEBHOOK_SECRET` |

## Requests

| Request | Método | Qué testea |
| ------- | ------ | ---------- |
| GET /health | GET | Servidor vivo |
| GET /webhook — Meta verification | GET | Handshake de Meta (devuelve `hub.challenge`) |
| GET /webhook — Invalid token | GET | Rechazo 403 con token malo |
| POST /webhook — Text message | POST | Mensaje WhatsApp simulado (firma HMAC automática) |
| POST /webhook — Invalid signature | POST | Rechazo 403 sin firma válida |
| POST /webhook — Status update | POST | Evento ignorado, responde 200 |

## Orden sugerido

1. **GET /health** → `200` con `{ "status": "ok" }`
2. **GET /webhook — Meta verification** → devuelve `test123`
3. **POST /webhook — Invalid signature** → `403`
4. **POST /webhook — Text message** → `200` (dispara flujo real: IA + WhatsApp)

## Grafana (logs)

URL: **https://grafana.uprit.edu.pe**

1. Login con `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` del `.env` del servidor
2. **Explore** → datasource **Loki**
3. Query:

```logql
{container="chatbot-uprit-app"} |= "error"
```

## Nota

**POST /webhook — Text message** ejecuta el flujo real en producción. Úsalo con cuidado.

Usa un número WhatsApp real en `test_wa_id` (con cuenta activa). Números ficticios como `51987654321` harán fallar el envío de la respuesta aunque el webhook responda 200.
