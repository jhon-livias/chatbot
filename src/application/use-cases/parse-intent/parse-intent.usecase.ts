import { z } from 'zod';
import { IntencionCodigo } from '../../../domain/enums/intencion-codigo.enum.js';
import { IntentParseError } from '../../exceptions/intent-parse.exception.js';
import { ParsedIntent } from './parse-intent.dto.js';
import type { ParseIntentDto, ParseIntentResult } from './parse-intent.dto.js';

// ═══════════════════════════════════════════════════════════════════════════
//  SCHEMA DE VALIDACIÓN — Zod
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Cualquier string vacío o con solo espacios se normaliza a `null`.
 * Esto protege contra respuestas del LLM del tipo `"filterValue": ""`.
 */
const nullableString = z
  .string()
  .transform((v) => (v.trim() === '' ? null : v.trim()))
  .nullable()
  .catch(null);

const IntentMetaDataSchema = z.object({
  filterType: nullableString,
  filterValue: nullableString,
});

const ParsedIntentSchema = z.object({
  /** El LLM puede devolver el intent con distinto casing — normalizamos */
  intent: z
    .string()
    .transform((v) => v.trim().toUpperCase())
    .pipe(z.nativeEnum(IntencionCodigo, {
      errorMap: () => ({
        message: `Valor de 'intent' no reconocido. Valores válidos: ${Object.values(IntencionCodigo).join(', ')}`,
      }),
    })),

  careerId: nullableString,

  metaData: IntentMetaDataSchema,
});

type RawParsedIntent = z.infer<typeof ParsedIntentSchema>;

// ═══════════════════════════════════════════════════════════════════════════
//  EXTRACTOR DE BLOQUE JSON
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extrae el primer bloque `{ ... }` balanceado de un string arbitrario.
 *
 * Estrategia: conteo de llaves con manejo explícito de strings JSON
 * (para ignorar `{` y `}` que aparecen dentro de valores string).
 *
 * @returns `{ block, wasNoisy }` donde `wasNoisy` indica si había texto extra.
 * @throws `IntentParseError` si no se encuentra ningún bloque o está incompleto.
 */
function extractJsonBlock(
  raw: string,
): { block: string; wasNoisy: boolean } {
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

    // Manejo de escape dentro de strings: \"
    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escapeNext = true;
      continue;
    }

    // Entrar/salir de un valor string
    if (ch === '"') {
      inString = !inString;
      continue;
    }

    // Ignorar todo dentro de un string
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

  // Se encontró `{` pero el bloque nunca se cerró
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
 * Parsea y valida la respuesta cruda del LLM cuando identifica la intención
 * del usuario. El LLM debe retornar un JSON con la estructura:
 *
 * ```json
 * {
 *   "intent": "INFORMACION_PROGRAMAS",
 *   "careerId": "ing-sistemas" | null,
 *   "metaData": {
 *     "filterType": "tipo" | null,
 *     "filterValue": "PREGRADO" | null
 *   }
 * }
 * ```
 *
 * El caso de uso tolera texto extra alrededor del bloque JSON (texto de
 * relleno, bloques de código markdown, etc.) y lanza `IntentParseError`
 * tipado ante cualquier fallo, permitiendo que el sistema decida reintentar.
 */
export class ParseIntentUseCase {
  execute(dto: ParseIntentDto): ParseIntentResult {
    const raw = dto.rawAiResponse;

    // ── Paso 1: Limpiar el bloque JSON del ruido del LLM ─────────────────
    const { block, wasNoisy } = extractJsonBlock(raw);

    // ── Paso 2: Parsear JSON ──────────────────────────────────────────────
    let parsed: unknown;
    try {
      parsed = JSON.parse(block);
    } catch (syntaxError) {
      throw new IntentParseError(
        `El bloque JSON extraído no es JSON válido: ${(syntaxError as Error).message}`,
        'INVALID_JSON_SYNTAX',
        raw,
      );
    }

    // ── Paso 3: Validar estructura con Zod ───────────────────────────────
    const validation = ParsedIntentSchema.safeParse(parsed);

    if (!validation.success) {
      const issues = validation.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join(' | ');

      throw new IntentParseError(
        `El JSON no cumple la estructura esperada — ${issues}`,
        'SCHEMA_VALIDATION_FAILED',
        raw,
      );
    }

    // ── Paso 4: Construir el Value Object inmutable ───────────────────────
    const data: RawParsedIntent = validation.data;

    const parsedIntent = new ParsedIntent(
      data.intent,
      data.careerId,
      {
        filterType: data.metaData.filterType,
        filterValue: data.metaData.filterValue,
      },
    );

    return { parsedIntent, wasExtractedFromNoise: wasNoisy };
  }
}
