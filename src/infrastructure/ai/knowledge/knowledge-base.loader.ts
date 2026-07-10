import { readFileSync } from 'node:fs';
import path from 'node:path';
import { logger } from '../../shared/logger.js';

/** Resolves the knowledge base path from KNOWLEDGE_BASE_PATH, defaulting to "<cwd>/context/knowledge_base.md". */
export function resolveKnowledgeBasePath(): string {
  return process.env['KNOWLEDGE_BASE_PATH'] ?? path.join(process.cwd(), 'context', 'knowledge_base.md');
}

/**
 * Appended after the static knowledge base to enforce the hybrid architecture:
 * static facts come from the file, but anything dynamic (costs, curriculum,
 * vacancies) MUST come from a tool call — never from the model's own knowledge.
 */
const TOOL_USAGE_ADDENDUM = `
───────────────────────────────────────────────────────────
REGLAS DE HERRAMIENTAS (TOOL CALLING) — LECTURA OBLIGATORIA
───────────────────────────────────────────────────────────
Eres el asistente oficial de la universidad. Para responder sobre procesos y
reglas, usa estrictamente el conocimiento proporcionado arriba. Si te
preguntan sobre COSTOS, MALLAS CURRICULARES o VACANTES de una carrera
específica, NO inventes la respuesta bajo ninguna circunstancia: debes
ejecutar la herramienta correspondiente ("obtener_costo_carrera" u
"obtener_informacion_carrera") y construir tu respuesta final únicamente con
el dato devuelto por esa herramienta.

- Si la herramienta indica que la carrera no fue encontrada o que no hay un
  dato registrado, informa al usuario que no cuentas con ese dato confirmado
  y ofrece derivarlo con un asesor. NUNCA estimes ni "redondees" un monto.
- Si la herramienta reporta un error técnico (base de datos no disponible),
  informa brevemente al usuario que hay un inconveniente técnico temporal y
  ofrece derivarlo con un asesor humano.
- No es necesario preguntar permiso al usuario para usar una herramienta:
  invócala directamente en cuanto identifiques que la pregunta requiere un
  dato dinámico (costo, malla, vacantes).
`;

let cachedKnowledgeBase: string | null = null;

/**
 * Reads the static knowledge base file once and caches it in memory.
 * Falls back to a minimal safe prompt if the file is missing/unreadable,
 * so a misconfigured deployment never crashes the chat engine.
 */
export function loadKnowledgeBase(filePath: string): string {
  if (cachedKnowledgeBase !== null) return cachedKnowledgeBase;

  try {
    const raw = readFileSync(filePath, 'utf-8');
    cachedKnowledgeBase = `${raw.trim()}\n${TOOL_USAGE_ADDENDUM}`;
    logger.info('[KnowledgeBase] Loaded static knowledge base', {
      filePath,
      chars: raw.length,
    });
  } catch (err) {
    logger.error('[KnowledgeBase] Failed to load knowledge base file — using minimal fallback', {
      filePath,
      error: err instanceof Error ? err.message : String(err),
    });
    cachedKnowledgeBase =
      'Eres el asistente oficial de la universidad. No cuentas con la base de conocimiento institucional ' +
      'cargada en este momento; responde solo con datos obtenidos mediante herramientas y deriva a un ' +
      'asesor humano ante cualquier duda que no puedas verificar.' + TOOL_USAGE_ADDENDUM;
  }

  return cachedKnowledgeBase;
}

/** Test-only helper: clears the in-memory cache so the file can be reloaded. */
export function clearKnowledgeBaseCache(): void {
  cachedKnowledgeBase = null;
}
