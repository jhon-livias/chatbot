export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

export type LogContext = Record<string, unknown>;

/**
 * Contrato de logging desacoplado del proveedor (Pino, Winston, etc.).
 * La salida debe ser JSON estructurado en producción para indexación en Loki.
 */
export interface ILogger {
  fatal(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  trace(message: string, context?: LogContext): void;
  /** Crea un logger hijo con contexto fijo (ej. módulo, requestId) */
  child(bindings: LogContext): ILogger;
}
