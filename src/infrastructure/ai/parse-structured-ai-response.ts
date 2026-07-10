export interface StructuredAiResponse {
  message: string;
  purchaseCategory: string | null;
}

/** True when the model returned the internal {message, purchaseCategory} wire format. */
export function looksLikeStructuredAiResponse(text: string): boolean {
  const t = text.trim();
  return t.startsWith('{') && t.includes('"message"') && t.includes('"purchaseCategory"');
}

function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

/**
 * Extracts the first balanced `{...}` block, respecting quoted strings.
 * Returns null when the payload is incomplete or not JSON-shaped.
 */
function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = start; i < raw.length; i++) {
    const ch = raw[i]!;
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return null;
}

/** Last-resort extractor for pretty-printed / slightly malformed JSON from the LLM. */
function lenientExtractMessageAndCategory(raw: string): StructuredAiResponse | null {
  const purchaseMatch = raw.match(/"purchaseCategory"\s*:\s*"([^"]+)"/);
  const messageKeyMatch = raw.match(/"message"\s*:\s*"/);
  if (!messageKeyMatch) return null;

  const contentStart = messageKeyMatch.index! + messageKeyMatch[0].length;
  const purchaseKeyIdx = raw.search(/"purchaseCategory"\s*:/);
  if (purchaseKeyIdx === -1 || purchaseKeyIdx <= contentStart) return null;

  let messageBody = raw.slice(contentStart, purchaseKeyIdx).trim();
  messageBody = messageBody.replace(/"\s*,?\s*$/, '');

  if (!messageBody) return null;

  return {
    message: messageBody.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\'),
    purchaseCategory: purchaseMatch?.[1] ?? null,
  };
}

/**
 * Converts an LLM response that may be `{"message":"...","purchaseCategory":"..."}` into
 * user-facing plain text. Prompts 4/5 (General / Categoría) use this internal JSON format;
 * WhatsApp must only ever receive the `message` field.
 */
export function parseStructuredAiResponse(raw: string): StructuredAiResponse {
  const trimmed = stripCodeFences(raw);
  if (!looksLikeStructuredAiResponse(trimmed)) {
    return { message: raw, purchaseCategory: null };
  }

  const block = extractJsonObject(trimmed);
  if (block) {
    try {
      const obj = JSON.parse(block) as Record<string, unknown>;
      if (typeof obj['message'] === 'string') {
        return {
          message: obj['message'],
          purchaseCategory: typeof obj['purchaseCategory'] === 'string' ? obj['purchaseCategory'] : null,
        };
      }
    } catch {
      // fall through to lenient parser
    }
  }

  const lenient = lenientExtractMessageAndCategory(trimmed);
  if (lenient) return lenient;

  return { message: raw, purchaseCategory: null };
}
