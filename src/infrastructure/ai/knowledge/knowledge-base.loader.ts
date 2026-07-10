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

───────────────────────────────────────────────────────────
FORMATO WHATSAPP — LECTURA OBLIGATORIA
───────────────────────────────────────────────────────────
El canal es WhatsApp: NO soporta tablas, markdown ni bloques de código.
NUNCA uses: | tablas |, **negritas**, ### encabezados, --- separadores,
ni bloques de código fenced.

Cuando informes COSTOS u otros montos, usa listas con viñetas en texto plano.
Ejemplo correcto:

Costos de [Carrera] — [Programa] ([Periodo])

En soles (PEN):
• Inscripción: S/ 100
• Pre-matrícula: S/ 200
• Cuota mensual (6 cuotas): S/ 340
• Inversión total: S/ 2,850
• Inversión con descuento*: S/ 2,340

En dólares (USD):
• Inscripción: $ 28
• Pre-matrícula: $ 55
• Cuota mensual (6 cuotas): $ 92
• Inversión total: $ 773
• Inversión con descuento*: $ 635

*Descuento del 20% por pago puntual.

Mantén las respuestas concisas, amables y fáciles de leer en pantalla de celular.
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
