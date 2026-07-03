# Admin Panel — UPRIT Asesores

Panel React para que los asesores comerciales atiendan leads de WhatsApp en modo Human Handoff.

## Stack

- React 18 + TypeScript
- Vite 6
- react-router-dom v6
- Sin librerías de UI externas (CSS propio, mobile-friendly)

## Desarrollo local

```bash
# Desde la raíz del repo:
npm run admin:dev
# Abre http://localhost:5173
# El proxy /api → http://localhost:3000 está configurado en vite.config.ts
```

Requiere que el backend esté corriendo (`npm run dev` desde la raíz).

## Build para producción

```bash
npm run admin:build   # genera admin/dist/
# o desde la raíz:
npm run build:all     # compila backend + admin juntos
```

El directorio `admin/dist/` es servido por Nginx en `admision.uprit.edu.pe` (ver PR #5).

## Flujo de uso

1. Asesor abre `https://admision.uprit.edu.pe` → pantalla de login.
2. Ingresa su **usuario** y **contraseña** (asignados con `deploy/seed-agent-passwords.mjs`).
3. El token JWT se guarda en `localStorage` como `uprit_agent_token`.
4. Pantalla **Inbox**: lista de chats asignados, polling cada 5 s, badge con no leídos.
5. Click en un chat → pantalla **Chat**: historial completo, campo para responder.
6. El mensaje se envía al lead por WhatsApp (mismo hilo UPRIT).
7. **Devolver al bot**: Angela retoma la atención y el agente sale del chat.
8. **Cerrar sesión**: limpia el token del localStorage.

## Variables de entorno

| Variable | Descripción |
|---|---|
| `VITE_API_BASE_URL` | URL base del backend (solo en dev; en prod es `''` same-origin) |

Archivo: `admin/.env.development`

```
VITE_API_BASE_URL=http://localhost:3000
```

## Seguridad

- El `agentId` nunca se envía desde el cliente; el backend lo extrae del JWT.
- `401` → logout automático + redirect a `/login`.
- `403` → mensaje "Este chat no está asignado a ti".
