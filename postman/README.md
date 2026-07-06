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
| POST /webhook — Image message | `200` + auto-reply bot (modo bot) o cola agente (modo human) |
| POST /webhook — Document message | `200` + auto-reply bot (modo bot) o cola agente (modo human) |
| POST /webhook — Status update | `200` (evento ignorado) |

## Orden de prueba

1. GET /health
2. GET /webhook — Meta verification
3. POST /webhook — Invalid signature
4. POST /webhook — Text message (número real en `test_wa_id`)
5. POST /webhook — Image message (payload sample abajo)
6. POST /webhook — Document message (payload sample abajo)

## Payload samples — inbound media (M2)

### Image

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "WABA_ID",
    "changes": [{
      "field": "messages",
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "15550000000",
          "phone_number_id": "1234567890"
        },
        "contacts": [{
          "profile": { "name": "Lead Test" },
          "wa_id": "51999999999"
        }],
        "messages": [{
          "from": "51999999999",
          "id": "wamid.INBOUND_IMAGE_ID",
          "timestamp": "1710000000",
          "type": "image",
          "image": {
            "caption": "Foto de mi DNI",
            "mime_type": "image/jpeg",
            "sha256": "abc123",
            "id": "META_MEDIA_ID_IMAGE"
          }
        }]
      }
    }]
  }]
}
```

### Document (PDF)

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "WABA_ID",
    "changes": [{
      "field": "messages",
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "15550000000",
          "phone_number_id": "1234567890"
        },
        "contacts": [{
          "profile": { "name": "Lead Test" },
          "wa_id": "51999999999"
        }],
        "messages": [{
          "from": "51999999999",
          "id": "wamid.INBOUND_DOC_ID",
          "timestamp": "1710000001",
          "type": "document",
          "document": {
            "caption": "Constancia de estudios",
            "filename": "constancia.pdf",
            "mime_type": "application/pdf",
            "sha256": "def456",
            "id": "META_MEDIA_ID_DOC"
          }
        }]
      }
    }]
  }]
}
```

**Comportamiento esperado (modo bot):** webhook `200`, media descargada de Meta y guardada localmente, auto-reply `AUTO_REPLY_UNSUPPORTED_MEDIA`, sin llamada a DeepSeek.

**Comportamiento esperado (modo human):** webhook `200`, media guardada, mensaje en inbox del agente asignado, sin auto-reply del bot.

## Outbound agent media (M3) — POST multipart

Requiere JWT de agente (`Authorization: Bearer {{agent_token}}`) y conversación en **modo human** con ventana 24h abierta.

### Enviar imagen al lead

```bash
curl -X POST "http://localhost:3000/api/v1/conversations/CONVERSATION_ID/messages" \
  -H "Authorization: Bearer AGENT_JWT" \
  -F "content=Adjunto tu brochure" \
  -F "file=@/ruta/a/foto.jpg;type=image/jpeg"
```

### Enviar PDF al lead

```bash
curl -X POST "http://localhost:3000/api/v1/conversations/CONVERSATION_ID/messages" \
  -H "Authorization: Bearer AGENT_JWT" \
  -F "content=Constancia adjunta" \
  -F "file=@/ruta/a/constancia.pdf;type=application/pdf"
```

### Solo texto (JSON, backward compatible)

```bash
curl -X POST "http://localhost:3000/api/v1/conversations/CONVERSATION_ID/messages" \
  -H "Authorization: Bearer AGENT_JWT" \
  -H "Content-Type: application/json" \
  -d '{"content":"Hola, ¿en qué puedo ayudarte?"}'
```

**MIME permitidos:** `image/jpeg`, `image/png`, `image/webp`, `application/pdf` — máximo 10 MB.

**Respuesta 201:** `{ "messageId": "wamid...", "status": "sent", "contentType": "image", "mediaUrl": "/media/..." }`

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
