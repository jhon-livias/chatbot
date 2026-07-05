import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer, IncomingMessage } from 'node:http';
import jwt from 'jsonwebtoken';
import type { RealtimePort } from '../../application/ports/realtime.port.js';
import type { AgentJwtPayload } from '../http/middlewares/authenticate-agent-jwt.middleware.js';
import { logger } from '../shared/logger.js';

const WS_PATH = '/api/v1/ws';

/**
 * WebSocket protocol (JSON text frames) for the admin panel.
 *
 * ## Authentication
 * Connect with JWT query param: `wss://host/api/v1/ws?token=<JWT>`
 * Same secret as `authenticateAgentJwt` (`JWT_SECRET`). Invalid/missing token → close 4401.
 *
 * ## Server → Client events
 * | type       | payload |
 * |------------|---------|
 * | `connected`| `{ agentId, username, name, role, heartbeatMs }` — sent once after auth |
 * | `pong`     | `{}` — reply to client `ping` |
 * | `ping`     | `{}` — server heartbeat; client should reply with `ping` or ignore |
 *
 * Phase 4 will add: `message.new`, `message.status`, `conversation.read`, `typing.start`, etc.
 *
 * ## Client → Server events
 * | type  | payload |
 * |-------|---------|
 * | `ping`| `{}` — client heartbeat; server replies `pong` |
 *
 * ## Heartbeat
 * - Interval: `WS_HEARTBEAT_MS` env (default 30_000 ms).
 * - Server sends `{ type: "ping" }` each interval.
 * - Connections with no inbound frame for 2× heartbeat are closed.
 *
 * ## Multi-tab
 * Multiple WebSocket connections per `agentId` are allowed (one per browser tab).
 */
export interface WebSocketRealtimeOptions {
  jwtSecret: string;
  heartbeatMs?: number;
}

interface ClientState {
  agentId: string;
  username: string;
  name: string;
  role: string;
  lastActivityAt: number;
}

type OutboundEvent =
  | { type: 'connected'; agentId: string; username: string; name: string; role: string; heartbeatMs: number }
  | { type: 'pong' }
  | { type: 'ping' };

export class WebSocketRealtimeAdapter implements RealtimePort {
  private wss: WebSocketServer | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  /** agentId → open sockets (supports multiple tabs per agent) */
  private readonly connections = new Map<string, Set<WebSocket>>();
  private readonly clientStates = new WeakMap<WebSocket, ClientState>();
  private readonly heartbeatMs: number;

  constructor(
    private readonly httpServer: HttpServer,
    private readonly options: WebSocketRealtimeOptions,
  ) {
    this.heartbeatMs = options.heartbeatMs ?? Number(process.env['WS_HEARTBEAT_MS'] ?? 30_000);
  }

  start(): void {
    if (this.wss) return;

    this.wss = new WebSocketServer({ noServer: true });

    this.httpServer.on('upgrade', (req, socket, head) => {
      if (!this.isWebSocketPath(req.url)) {
        socket.destroy();
        return;
      }

      const token = this.extractToken(req);
      const agent = this.verifyToken(token);
      if (!agent) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      this.wss!.handleUpgrade(req, socket, head, (ws) => {
        this.registerConnection(ws, agent);
        this.wss!.emit('connection', ws, req);
      });
    });

    this.wss.on('connection', (ws: WebSocket) => {
      const state = this.clientStates.get(ws);
      if (!state) {
        ws.close(1011, 'Internal error');
        return;
      }

      this.send(ws, {
        type: 'connected',
        agentId: state.agentId,
        username: state.username,
        name: state.name,
        role: state.role,
        heartbeatMs: this.heartbeatMs,
      });

      ws.on('message', (data) => {
        this.touch(ws);
        this.handleClientMessage(ws, data);
      });

      ws.on('close', () => this.unregisterConnection(ws));
      ws.on('error', (err) => {
        logger.warn('[WS] Client error', { agentId: state.agentId, error: err.message });
        this.unregisterConnection(ws);
      });
    });

    this.heartbeatTimer = setInterval(() => this.runHeartbeat(), this.heartbeatMs);
    logger.info('[WS] Realtime server ready', { path: WS_PATH, heartbeatMs: this.heartbeatMs });
  }

  async stop(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    for (const sockets of this.connections.values()) {
      for (const ws of sockets) {
        ws.close(1001, 'Server shutting down');
      }
    }
    this.connections.clear();

    await new Promise<void>((resolve) => {
      if (!this.wss) {
        resolve();
        return;
      }
      this.wss.close(() => resolve());
      this.wss = null;
    });
  }

  getConnectedAgentCount(): number {
    return this.connections.size;
  }

  private isWebSocketPath(url: string | undefined): boolean {
    if (!url) return false;
    try {
      const pathname = new URL(url, 'http://localhost').pathname;
      return pathname === WS_PATH;
    } catch {
      return url.startsWith(WS_PATH);
    }
  }

  private extractToken(req: IncomingMessage): string | null {
    if (!req.url) return null;
    try {
      const params = new URL(req.url, 'http://localhost').searchParams;
      return params.get('token');
    } catch {
      return null;
    }
  }

  private verifyToken(token: string | null): AgentJwtPayload | null {
    if (!token) return null;
    try {
      return jwt.verify(token, this.options.jwtSecret) as AgentJwtPayload;
    } catch {
      return null;
    }
  }

  private registerConnection(ws: WebSocket, agent: AgentJwtPayload): void {
    const agentId = agent.sub;
    const state: ClientState = {
      agentId,
      username: agent.username,
      name: agent.name,
      role: agent.role ?? 'agent',
      lastActivityAt: Date.now(),
    };
    this.clientStates.set(ws, state);

    let sockets = this.connections.get(agentId);
    if (!sockets) {
      sockets = new Set();
      this.connections.set(agentId, sockets);
    }
    sockets.add(ws);

    logger.info('[WS] Agent connected', {
      agentId,
      username: agent.username,
      tabs: sockets.size,
    });
  }

  private unregisterConnection(ws: WebSocket): void {
    const state = this.clientStates.get(ws);
    if (!state) return;

    const sockets = this.connections.get(state.agentId);
    if (sockets) {
      sockets.delete(ws);
      if (sockets.size === 0) {
        this.connections.delete(state.agentId);
      }
    }
    this.clientStates.delete(ws);

    logger.info('[WS] Agent disconnected', { agentId: state.agentId });
  }

  private touch(ws: WebSocket): void {
    const state = this.clientStates.get(ws);
    if (state) state.lastActivityAt = Date.now();
  }

  private handleClientMessage(ws: WebSocket, data: WebSocket.RawData): void {
    let parsed: { type?: string };
    try {
      parsed = JSON.parse(String(data)) as { type?: string };
    } catch {
      return;
    }

    if (parsed.type === 'ping') {
      this.send(ws, { type: 'pong' });
    }
  }

  private runHeartbeat(): void {
    const staleThreshold = this.heartbeatMs * 2;
    const now = Date.now();

    for (const sockets of this.connections.values()) {
      for (const ws of sockets) {
        const state = this.clientStates.get(ws);
        if (!state) continue;

        if (now - state.lastActivityAt > staleThreshold) {
          logger.warn('[WS] Closing stale connection', { agentId: state.agentId });
          ws.close(1000, 'Heartbeat timeout');
          continue;
        }

        this.send(ws, { type: 'ping' });
      }
    }
  }

  private send(ws: WebSocket, event: OutboundEvent): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }
}
