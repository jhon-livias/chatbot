# ═══════════════════════════════════════════════════════════════════════════════
#  STAGE 1 — prod-deps
#  Instala únicamente las dependencias de producción (sin devDependencies).
#  Esta capa se cachea independientemente del código fuente: si solo cambia
#  el código, Docker reutiliza esta capa sin reinstalar paquetes.
# ═══════════════════════════════════════════════════════════════════════════════
FROM node:24-alpine AS prod-deps

WORKDIR /app

COPY package*.json ./

# --omit=dev excluye todas las devDependencies (typescript, eslint, @types/*, etc.)
RUN npm ci --omit=dev --ignore-scripts


# ═══════════════════════════════════════════════════════════════════════════════
#  STAGE 2 — builder
#  Instala TODAS las dependencias (incluyendo dev), compila TypeScript
#  y produce el directorio dist/.
# ═══════════════════════════════════════════════════════════════════════════════
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src ./src

RUN npm run build


# ═══════════════════════════════════════════════════════════════════════════════
#  STAGE 2b — admin-build
#  Compila el panel React (admin/dist) para servir vía Nginx en el host.
#  En producción: nginx lee /opt/chatbot-uprit/admin/dist (no va dentro del contenedor app).
# ═══════════════════════════════════════════════════════════════════════════════
FROM node:24-alpine AS admin-build

WORKDIR /app/admin

COPY admin/package*.json ./
RUN npm ci --ignore-scripts

COPY admin/tsconfig*.json admin/vite.config.ts admin/index.html ./
COPY admin/src ./src

RUN npm run build


# ═══════════════════════════════════════════════════════════════════════════════
#  STAGE 3 — production
#  Imagen final: node:24-alpine + node_modules de prod + dist/ compilado.
#  No contiene código fuente TypeScript, devDependencies ni el compilador.
# ═══════════════════════════════════════════════════════════════════════════════
FROM node:24-alpine AS production

# ── Metadatos OCI ──────────────────────────────────────────────────────────────
LABEL org.opencontainers.image.title="chatbot-uprit"
LABEL org.opencontainers.image.description="Backend chatbot UPRIT — Clean Architecture, Node 24, TypeScript"
LABEL org.opencontainers.image.vendor="UPRIT"

# ── Usuario no-root (principio de mínimo privilegio) ──────────────────────────
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# ── Copiar artefactos desde stages anteriores ─────────────────────────────────
COPY --from=prod-deps  --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder    --chown=appuser:appgroup /app/dist         ./dist
COPY --chown=appuser:appgroup package.json ./

# ── Variables de entorno con valores por defecto seguros ──────────────────────
ENV NODE_ENV=production
ENV PORT=3000

# ── Seguridad: el proceso no puede escribir fuera de /app ─────────────────────
USER appuser

EXPOSE 3000

# ── Health check usando el endpoint /health de Express ────────────────────────
# wget está incluido en busybox (Alpine) — no requiere curl
HEALTHCHECK \
  --interval=30s \
  --timeout=5s \
  --start-period=15s \
  --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/health || exit 1

# ── Punto de entrada — sin --env-file: Docker inyecta las variables ───────────
CMD ["node", "dist/main.js"]
