import type { IntencionCodigo } from '../../../domain/enums/intencion-codigo.enum.js';

// ── Input ─────────────────────────────────────────────────────────────────

export interface ParseIntentDto {
  /**
   * String crudo devuelto por DeepSeek.
   * Puede contener texto extra antes/después del JSON:
   *   "Sure! Here's the result: { ... } Let me know..."
   */
  rawAiResponse: string;
}

// ── Estructura esperada del JSON generado por el LLM ─────────────────────

export interface IntentMetaData {
  /**
   * Tipo de filtro que el usuario quiere aplicar para explorar programas.
   * Ejemplos: "tipo", "modalidad", "facultad", "nombre"
   * `null` cuando la intención no requiere filtrar.
   */
  filterType: string | null;

  /**
   * Valor concreto del filtro (ej. "PREGRADO", "VIRTUAL", "Ingeniería").
   * `null` cuando filterType es null o no se detectó un valor.
   */
  filterValue: string | null;
}

// ── Output — Value Object inmutable ──────────────────────────────────────

export class ParsedIntent {
  /** Intención identificada — uno de los IntencionCodigo del sistema */
  readonly intent: IntencionCodigo;

  /**
   * Slug o ID del programa de interés del usuario.
   * `null` si el usuario no mencionó un programa específico.
   */
  readonly careerId: string | null;

  /** Metadatos auxiliares para filtrar o contextualizar la respuesta */
  readonly metaData: Readonly<IntentMetaData>;

  constructor(intent: IntencionCodigo, careerId: string | null, metaData: IntentMetaData) {
    this.intent = intent;
    this.careerId = careerId;
    this.metaData = Object.freeze({ ...metaData });
    Object.freeze(this);
  }

  /** True si la intención requiere buscar información de un programa específico */
  requiresProgram(): boolean {
    return this.careerId !== null;
  }

  /** True si se debe aplicar algún tipo de filtro sobre los programas */
  hasFilter(): boolean {
    return this.metaData.filterType !== null && this.metaData.filterValue !== null;
  }

  toJSON(): Record<string, unknown> {
    return {
      intent: this.intent,
      careerId: this.careerId,
      metaData: this.metaData,
    };
  }
}

// ── Result ────────────────────────────────────────────────────────────────

export interface ParseIntentResult {
  parsedIntent: ParsedIntent;
  /** Indica si el JSON fue extraído con limpieza (había texto extra alrededor) */
  wasExtractedFromNoise: boolean;
}
