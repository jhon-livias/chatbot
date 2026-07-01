import { z, ZodError } from 'zod';
import { IntencionCodigo } from '../../../domain/enums/intencion-codigo.enum.js';
import { IntentParseError } from '../../exceptions/intent-parse.exception.js';
import { ParsedIntent } from './parse-intent.dto.js';
import type { ParseIntentDto, ParseIntentResult } from './parse-intent.dto.js';

// ═══════════════════════════════════════════════════════════════════════════
//  SCHEMA ESTRICTO — Zod
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normaliza un string: recorta espacios y convierte "" en null.
 * Protege contra respuestas del LLM como `"filterType": "  "`.
 */
const cleanString = z
  .string()
  .transform((v) => v.trim())
  .transform((v) => (v === '' ? null : v));

const IntentMetaDataSchema = z
  .object({
    /** "tipo" | "modalidad" | "facultad" | "nombre" | null */
    filterType: cleanString.nullable().default(null),
    /**
     * Array de valores de filtro.
     * El LLM puede enviar un string suelto o un array; normalizamos ambos.
     */
    filterValue: z
      .union([
        z.array(z.string()),
        // Tolerancia: si el LLM manda un string en lugar de array, lo envolvemos
        z.string().transform((v) => (v.trim() === '' ? [] : [v.trim()])),
      ])
      .default([]),
  })
  .optional();

const ParsedIntentSchema = z
  .object({
    /**
     * El LLM puede enviar el intent en cualquier casing.
     * Lo normalizamos a UPPERCASE antes de validar contra el enum.
     */
    intent: z
      .string({ required_error: "El campo 'intent' es requerido" })
      .transform((v) => v.trim().toUpperCase())
      .pipe(
        z.nativeEnum(IntencionCodigo, {
          errorMap: () => ({
            message: `Valor de 'intent' no reconocido. Válidos: ${Object.values(IntencionCodigo).join(', ')}`,
          }),
        }),
      ),

    /** String con el slug/ID del programa, o null si no aplica */
    careerId: cleanString.nullable().optional().default(null),

    /** Metadatos para filtrar resultados — campo completamente opcional */
    metaData: IntentMetaDataSchema,
  })
  .strict(); // rechaza campos desconocidos en el root

type ValidatedIntent = z.infer<typeof ParsedIntentSchema>;

// ═══════════════════════════════════════════════════════════════════════════
//  EXTRACTOR DE BLOQUE JSON (conteo de llaves balanceadas)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extrae el primer bloque `{ ... }` balanceado de un string arbitrario.
 * Maneja correctamente strings JSON internos (con `"`, `\"`, `{`, `}`).
 *
 * @throws `IntentParseError` si no hay ningún `{` o el bloque no cierra.
 */
function extractJsonBlock(raw: string): { block: string; wasNoisy: boolean } {
  const start = raw.indexOf('{');

  if (start === -1) {
    throw new IntentParseError(
      'La respuesta del LLM no contiene ningún bloque JSON ({ ... })',
      'NO_JSON_BLOCK_FOUND',
      raw,
    );
  }

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = start; i < raw.length; i++) {
    const ch = raw[i] as string;

    if (escapeNext) { escapeNext = false; continue; }
    if (ch === '\\' && inString) { escapeNext = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const block = raw.slice(start, i + 1);
        const wasNoisy = start > 0 || i < raw.length - 1;
        return { block, wasNoisy };
      }
    }
  }

  throw new IntentParseError(
    'El bloque JSON encontrado está incompleto (llaves sin cerrar)',
    'INCOMPLETE_JSON_BLOCK',
    raw,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  CASO DE USO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parsea y valida la respuesta cruda del LLM cuando identifica la intención.
 *
 * JSON esperado del LLM:
 * ```json
 * {
 *   "intent": "INFORMACION_PROGRAMAS",
 *   "careerId": "ing-sistemas" | null,
 *   "metaData": {
 *     "filterType": "tipo" | null,
 *     "filterValue": ["PREGRADO", "MAESTRIA"]
 *   }
 * }
 * ```
 *
 * Tolerancias:
 * - Texto extra alrededor del bloque JSON (markdown, frases de relleno del LLM)
 * - `intent` en cualquier casing (normalizado a UPPERCASE)
 * - `careerId` ausente o vacío (→ null)
 * - `metaData` completamente ausente (→ undefined)
 * - `filterValue` como string suelto en lugar de array (→ [string])
 *
 * Errores lanzados: `IntentParseError` con `reason` tipado para control
 * del sistema de reintentos.
 */
export class ParseIntentUseCase {
  execute(dto: ParseIntentDto): ParseIntentResult {
    const raw = dto.rawAiResponse;

    // ── Paso 1: Extraer el bloque JSON limpiando ruido del LLM ───────────
    const { block, wasNoisy } = extractJsonBlock(raw);

    // ── Paso 2: Parsear a objeto JavaScript ──────────────────────────────
    let parsed: unknown;
    try {
      parsed = JSON.parse(block);
    } catch (syntaxError) {
      throw new IntentParseError(
        `El bloque JSON no es JSON válido: ${(syntaxError as SyntaxError).message}`,
        'INVALID_JSON_SYNTAX',
        raw,
      );
    }

    // ── Paso 3: Validar y transformar con Zod (.parse lanza ZodError) ────
    let data: ValidatedIntent;
    try {
      data = ParsedIntentSchema.parse(parsed);
    } catch (err) {
      if (err instanceof ZodError) {
        const issues = err.issues
          .map((i) => `[${i.path.join('.') || 'root'}] ${i.message}`)
          .join(' | ');

        throw new IntentParseError(
          `Esquema inválido — ${issues}`,
          'SCHEMA_VALIDATION_FAILED',
          raw,
        );
      }
      // Error inesperado — re-lanzar sin wrap
      throw err;
    }

    // ── Paso 4: Construir el Value Object inmutable ───────────────────────
    const parsedIntent = new ParsedIntent(
      data.intent,
      data.careerId ?? null,
      data.metaData,
    );

    return { parsedIntent, wasExtractedFromNoise: wasNoisy };
  }
}
