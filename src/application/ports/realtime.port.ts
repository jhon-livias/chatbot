/**
 * Port for pushing realtime events to connected admin clients (WebSocket adapter).
 * Phase 4 will extend this with publish/broadcast methods.
 */
export interface RealtimePort {
  /** Attach WebSocket server to the HTTP server and begin accepting connections. */
  start(): void;

  /** Close all connections and stop heartbeat timers. */
  stop(): Promise<void>;

  /** Number of distinct agents with at least one open connection. */
  getConnectedAgentCount(): number;
}
