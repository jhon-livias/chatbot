import { ApplicationException } from './application.exception.js';

export type IntentParseReason =
  | 'NO_JSON_BLOCK_FOUND'   // El LLM no devolvió ningún `{`
  | 'INCOMPLETE_JSON_BLOCK' // El bloque `{...}` no cierra correctamente
  | 'INVALID_JSON_SYNTAX'   // JSON.parse() falló
  | 'SCHEMA_VALIDATION_FAILED'; // El JSON no cumple la estructura esperada

/**
 * Error tipado lanzado por `ParseIntentUseCase` cuando la respuesta cruda
 * del LLM no puede convertirse en un `ParsedIntent` válido.
 *
 * El `reason` permite al sistema de chatbot decidir si reintentar la llamada
 * a la IA (INVALID_JSON_SYNTAX, NO_JSON_BLOCK_FOUND) o escalar a un agente
 * humano (SCHEMA_VALIDATION_FAILED repetido).
 */
export class IntentParseError extends ApplicationException {
  readonly reason: IntentParseReason;
  /** Fragmento del string crudo que provocó el fallo (primeros 500 chars) */
  readonly rawFragment: string;

  constructor(message: string, reason: IntentParseReason, rawInput: string) {
    super(message, 'INTENT_PARSE_ERROR');
    this.name = 'IntentParseError';
    this.reason = reason;
    this.rawFragment = rawInput.slice(0, 500);
    Error.captureStackTrace(this, this.constructor);
  }

  /** True si el error justifica reintentar la llamada al LLM */
  get isRetryable(): boolean {
    return (
      this.reason === 'NO_JSON_BLOCK_FOUND' ||
      this.reason === 'INVALID_JSON_SYNTAX' ||
      this.reason === 'INCOMPLETE_JSON_BLOCK'
    );
  }
}
