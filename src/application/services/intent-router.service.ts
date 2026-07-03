import type { AiProviderPort, ChatMessage } from '../ports/ai-provider.port.js';
import type { ProgramRepository } from '../../domain/repositories/program.repository.js';
import type { PromptRepository } from '../../domain/repositories/prompt.repository.js';
import type { FunnelIntentionRepository } from '../../domain/repositories/funnel-intention.repository.js';
import type { ContextSourceDataRepository } from '../../domain/repositories/context-source-data.repository.js';
import type { FacultyRepository } from '../../domain/repositories/faculty.repository.js';
import type { Message } from '../../domain/entities/message.entity.js';
import type { ConversationMetaData } from '../../domain/entities/conversation.entity.js';
import type { FunnelIntention } from '../../domain/entities/funnel-intention.entity.js';
import type { Prompt } from '../../domain/entities/prompt.entity.js';
import type { Program } from '../../domain/entities/program.entity.js';
import { TemplateService } from '../../infrastructure/ai/template/template.service.js';
import { logger } from '../../infrastructure/shared/logger.js';

export interface IntentRoutingResult {
  content: string;
  model: string;
  totalTokens: number;
  newCareerId: string | null;
  newMetaData: ConversationMetaData | null;
  newProgramName: string | null;
}

// -----------------------------------------------------------------------
// Keyword matching helpers to identify the role of each intention by type
// -----------------------------------------------------------------------
const KEYWORDS: Record<string, string[]> = {
  IDENTIFY: ['IDENTIFICAR', 'IDENTIFY', 'INTENT', 'IDENTIFY_NEED'],
  INFO_PROGRAM: ['INFORMACION_PROGRAMA', 'INFORMACION_PROGRAMAS', 'INFO_PROGRAM', 'BRINDAR_INFORMACION', 'PROGRAM_INFO'],
  ADMISION: ['PROCESO_ADMISION', 'ADMISION', 'ADMISSION', 'PROCESO_ADMISIÓN'],
  CATEGORIA: ['PROGRAMAS_POR_CATEGORIA', 'CATEGORIA', 'CATEGORY', 'BY_CATEGORY'],
  GENERAL: ['SOLICITAR_MAS_INFORMACION', 'GENERAL', 'FIRST_CONTACT', 'MAS_INFORMACION', 'PEDIR_MAS_INFORMACION'],
  EMBEDDING: ['GENERAR_QUERY', 'EMBEDDING', 'QUERY_EMBEDDING', 'GENERAR_QUERY_EMBEDDINGS'],
  MULTIPLE: ['RESOLVER_DUDAS', 'MULTIPLE', 'VARIOS_PROGRAMAS', 'RESOLVER', 'MULTI'],
};

function matchesKeywords(type: string, group: string): boolean {
  const upper = type.toUpperCase();
  return (KEYWORDS[group] ?? []).some((kw) => upper === kw || upper.includes(kw) || kw.includes(upper));
}

function findIntentionByRole(intentions: FunnelIntention[], role: string): FunnelIntention | undefined {
  return intentions.find((i) => matchesKeywords(i.type, role));
}

function findPromptForIntention(prompts: Prompt[], intentionId: string): Prompt | undefined {
  return prompts.find((p) => p.intentionId === intentionId && p.active);
}

// -----------------------------------------------------------------------
// Message context builders
// -----------------------------------------------------------------------

/**
 * Converts the conversation Message array into the format expected by all prompt templates.
 * The last user message is marked as "por responder"; all others as "respondido".
 */
function buildMessagesContext(messages: ReadonlyArray<Message>): Array<Record<string, unknown>> {
  const result: Array<Record<string, unknown>> = [];
  let lastUserIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === 'user') { lastUserIndex = i; break; }
  }

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]!;
    result.push({
      role: m.role === 'assistant' ? 'bot' : m.role,
      text: m.content,
      isAnswered: i !== lastUserIndex,
    });
  }
  return result;
}

/** Parses the raw JSON string returned by Prompt 1 (intent detection). */
function extractIntentJson(raw: string): {
  intent: string;
  careerId: string | null;
  metaData: ConversationMetaData | null;
} | null {
  const start = raw.indexOf('{');
  if (start === -1) return null;
  let depth = 0; let inStr = false; let esc = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i]!;
    if (esc) { esc = false; continue; }
    if (ch === '\\' && inStr) { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) {
      try {
        const obj = JSON.parse(raw.slice(start, i + 1)) as Record<string, unknown>;
        const intent = String(obj['intent'] ?? '').trim();
        const careerId = obj['careerId'] ? String(obj['careerId']).trim() : null;
        const md = obj['metaData'] as Record<string, unknown> | null | undefined;
        const metaData: ConversationMetaData | null = md
          ? {
              filterType: md['filterType'] ? String(md['filterType']) : null,
              filterValue: Array.isArray(md['filterValue'])
                ? (md['filterValue'] as unknown[]).map(String)
                : md['filterValue'] ? String(md['filterValue']) : null!,
            }
          : null;
        return { intent, careerId: careerId || null, metaData };
      } catch { return null; }
    }}
  }
  return null;
}

// -----------------------------------------------------------------------
// Service
// -----------------------------------------------------------------------

/**
 * Implements the 7-prompt intent routing pipeline described in the technical requirements.
 *
 * Flow:
 *  1. Run Prompt 1 (IDENTIFY INTENT) → get {intent, careerId, metaData}
 *  2. Route to the appropriate response prompt based on intent
 *  3. Build Handlebars context for that prompt
 *  4. Compile template + call DeepSeek
 *  5. Return result + updated intent context for the conversation
 *
 * If the prompts / intentions are not yet configured in the DB this service throws so
 * the caller (HandleIncomingMessageUseCase) can fall back to the monolithic system prompt.
 */
export class IntentRouterService {
  private readonly templateService: TemplateService;

  constructor(
    private readonly aiProvider: AiProviderPort,
    private readonly programRepo: ProgramRepository,
    private readonly promptRepo: PromptRepository,
    private readonly funnelIntentionRepo: FunnelIntentionRepository,
    private readonly contextSourceRepo: ContextSourceDataRepository,
    private readonly facultyRepo?: FacultyRepository,
  ) {
    this.templateService = new TemplateService();
  }

  async route(params: {
    messages: ReadonlyArray<Message>;
    userMessage: string;
    careerId: string | null;
    metaData: ConversationMetaData | null;
    programName: string | null;
  }): Promise<IntentRoutingResult> {
    const { messages, userMessage, careerId, metaData, programName } = params;

    // Load all DB data in parallel
    const [intentions, prompts, programs, faculties] = await Promise.all([
      this.funnelIntentionRepo.findActive(),
      this.promptRepo.findActive(),
      this.programRepo.findActive(),
      this.facultyRepo ? this.facultyRepo.findAll() : Promise.resolve([]),
    ]);

    if (intentions.length === 0) {
      throw new Error('[IntentRouter] No active funnel intentions in DB — cannot route');
    }
    if (prompts.length === 0) {
      throw new Error('[IntentRouter] No active prompts in DB — cannot route');
    }

    // ── Step 1: Identify intent ─────────────────────────────────────────
    const identifyIntention = findIntentionByRole(intentions, 'IDENTIFY');
    if (!identifyIntention) {
      throw new Error('[IntentRouter] IDENTIFY_INTENT intention not found in DB');
    }

    const identifyPrompt = findPromptForIntention(prompts, identifyIntention.id);
    if (!identifyPrompt) {
      throw new Error(`[IntentRouter] No prompt found for intention ${identifyIntention.id}`);
    }

    const intentContext = this.buildIdentifyContext(
      messages, userMessage, careerId, metaData, programs, intentions,
    );

    const compiledIdentify = this.templateService.compile(identifyPrompt.template, intentContext);
    logger.debug('[IntentRouter] Running intent detection', {
      missingVars: compiledIdentify.missingVariables,
    });

    const intentRaw = await this.aiProvider.complete([
      { role: 'system', content: compiledIdentify.rendered },
      { role: 'user', content: userMessage },
    ]);

    const parsed = extractIntentJson(intentRaw.content);
    if (!parsed || !parsed.intent) {
      throw new Error(`[IntentRouter] Could not parse intent JSON: ${intentRaw.content.slice(0, 200)}`);
    }

    logger.info('[IntentRouter] Intent detected', {
      intent: parsed.intent,
      careerId: parsed.careerId,
      metaData: parsed.metaData,
    });

    // Update context from the intent response (careerId takes priority from AI over previous)
    const newCareerId = parsed.careerId ?? careerId;
    const newMetaData = parsed.metaData ?? metaData;

    // ── Step 2: Find the matched intention ─────────────────────────────
    const matchedIntention = intentions.find(
      (i) => i.id === parsed.intent || i.type.toUpperCase() === parsed.intent.toUpperCase(),
    );

    // Determine routing group
    const routingGroup = this.resolveRoutingGroup(matchedIntention, parsed.intent, intentions);

    logger.info('[IntentRouter] Routing to group', { group: routingGroup, intention: matchedIntention?.type });

    // ── Step 3: Route to the appropriate prompt ─────────────────────────
    let result: IntentRoutingResult;

    switch (routingGroup) {
      case 'INFO_PROGRAM':
        result = await this.handleInfoProgram(messages, userMessage, newCareerId, programs, prompts, intentions, intentRaw);
        break;
      case 'ADMISION':
        result = await this.handleAdmision(messages, userMessage, newCareerId, programs, prompts, intentions, intentRaw);
        break;
      case 'CATEGORIA':
        result = await this.handleCategoria(messages, userMessage, newMetaData, programs, prompts, intentions, intentRaw);
        break;
      case 'GENERAL':
        result = await this.handleGeneral(messages, userMessage, faculties, prompts, intentions, intentRaw);
        break;
      case 'EMBEDDING':
      case 'MULTIPLE':
        result = await this.handleEmbeddingSearch(messages, userMessage, programName, programs, prompts, intentions, intentRaw);
        break;
      default:
        // Unknown intent — fall back to general info
        logger.warn('[IntentRouter] Unknown routing group, falling back to GENERAL', { group: routingGroup });
        result = await this.handleGeneral(messages, userMessage, faculties, prompts, intentions, intentRaw);
    }

    return {
      ...result,
      newCareerId,
      newMetaData,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Routing handlers
  // ─────────────────────────────────────────────────────────────────────────

  private async handleInfoProgram(
    messages: ReadonlyArray<Message>,
    userMessage: string,
    careerId: string | null,
    programs: Program[],
    prompts: Prompt[],
    intentions: FunnelIntention[],
    fallback: { content: string; model: string; totalTokens: number },
  ): Promise<IntentRoutingResult> {
    const intention = findIntentionByRole(intentions, 'INFO_PROGRAM');
    const prompt = intention ? findPromptForIntention(prompts, intention.id) : undefined;
    if (!prompt) return this.fallbackResult(fallback);

    const fullText = await this.getFullTextContent(careerId, programs);
    const ctx = this.buildProgramResponseContext(messages, fullText);
    return this.compileAndCall(prompt.template, ctx, userMessage, fallback, null);
  }

  private async handleAdmision(
    messages: ReadonlyArray<Message>,
    userMessage: string,
    careerId: string | null,
    programs: Program[],
    prompts: Prompt[],
    intentions: FunnelIntention[],
    fallback: { content: string; model: string; totalTokens: number },
  ): Promise<IntentRoutingResult> {
    const intention = findIntentionByRole(intentions, 'ADMISION');
    const prompt = intention ? findPromptForIntention(prompts, intention.id) : undefined;
    if (!prompt) return this.fallbackResult(fallback);

    const fullText = await this.getFullTextContent(careerId, programs);
    const ctx = this.buildProgramResponseContext(messages, fullText);
    return this.compileAndCall(prompt.template, ctx, userMessage, fallback, null);
  }

  private async handleCategoria(
    messages: ReadonlyArray<Message>,
    userMessage: string,
    metaData: ConversationMetaData | null,
    programs: Program[],
    prompts: Prompt[],
    intentions: FunnelIntention[],
    fallback: { content: string; model: string; totalTokens: number },
  ): Promise<IntentRoutingResult> {
    const intention = findIntentionByRole(intentions, 'CATEGORIA');
    const prompt = intention ? findPromptForIntention(prompts, intention.id) : undefined;
    if (!prompt) return this.fallbackResult(fallback);

    const filterValue = metaData?.filterValue ?? null;
    const filterType = metaData?.filterType ?? null;

    const filteredPrograms = filterType && filterValue
      ? programs.filter((p) => this.programMatchesFilter(p, filterType, filterValue))
      : programs;

    const lastUserMessages = messages.filter((m) => m.role === 'user').slice(-1);
    const ctx: Record<string, unknown> = {
      messages: buildMessagesContext(messages),
      lastUserMessage: lastUserMessages.map((m) => ({ text: m.content })),
      metadata: {
        filterValue: Array.isArray(filterValue) ? filterValue.join(', ') : (filterValue ?? ''),
      },
      careers: filteredPrograms.map((p) => ({
        name: p.name,
        modalities: p.modalities.map((mod) => ({
          careerType: mod.careerType,
          modalities: mod.modalities,
        })),
      })),
    };
    return this.compileAndCall(prompt.template, ctx, userMessage, fallback, null);
  }

  private async handleGeneral(
    messages: ReadonlyArray<Message>,
    userMessage: string,
    faculties: Array<{ id: string; name: string; description: string; slug: string; type: string }>,
    prompts: Prompt[],
    intentions: FunnelIntention[],
    fallback: { content: string; model: string; totalTokens: number },
  ): Promise<IntentRoutingResult> {
    const intention = findIntentionByRole(intentions, 'GENERAL');
    const prompt = intention ? findPromptForIntention(prompts, intention.id) : undefined;
    if (!prompt) return this.fallbackResult(fallback);

    const lastUserMessages = messages.filter((m) => m.role === 'user').slice(-1);
    const ctx: Record<string, unknown> = {
      messages: buildMessagesContext(messages),
      lastUserMessage: lastUserMessages.map((m) => ({ text: m.content })),
      faculties: faculties.map((f) => ({ id: f.id, name: f.name, description: f.description })),
    };
    return this.compileAndCall(prompt.template, ctx, userMessage, fallback, null);
  }

  private async handleEmbeddingSearch(
    messages: ReadonlyArray<Message>,
    userMessage: string,
    programName: string | null,
    programs: Program[],
    prompts: Prompt[],
    intentions: FunnelIntention[],
    fallback: { content: string; model: string; totalTokens: number },
  ): Promise<IntentRoutingResult> {
    // Step 1: Run Prompt 6 (embedding query generator)
    const embIntention = findIntentionByRole(intentions, 'EMBEDDING');
    const embPrompt = embIntention ? findPromptForIntention(prompts, embIntention.id) : undefined;

    let searchQuery = userMessage;
    let resolvedProgramName = programName;

    if (embPrompt) {
      const embCtx: Record<string, unknown> = {
        session: { programName: programName ?? '' },
        careers: programs.map((p) => ({ name: p.name })),
        messages: buildMessagesContext(messages),
      };
      const compiledEmb = this.templateService.compile(embPrompt.template, embCtx);
      const embRaw = await this.aiProvider.complete([
        { role: 'system', content: compiledEmb.rendered },
        { role: 'user', content: userMessage },
      ]);

      const rawQuery = embRaw.content.trim();

      // Detect handoff trigger inside Prompt 6 response
      if (rawQuery === 'HANDOFF_TRIGGER') {
        return { content: 'HANDOFF_TRIGGER', model: embRaw.model, totalTokens: embRaw.totalTokens, newCareerId: null, newMetaData: null, newProgramName: null };
      }

      // Parse the query format: "[PROGRAM_NAME] | [SEMANTIC_QUERY]" or just "[SEMANTIC_QUERY]"
      const pipeIdx = rawQuery.indexOf('|');
      if (pipeIdx !== -1) {
        resolvedProgramName = rawQuery.slice(0, pipeIdx).trim() || programName;
        searchQuery = rawQuery.slice(pipeIdx + 1).trim();
      } else {
        searchQuery = rawQuery;
      }
    }

    // Step 2: Search context_source_data
    let contextDocs = await this.contextSourceRepo.searchByText(searchQuery, 5);

    // If a specific program name was identified, also try to fetch its content
    if (resolvedProgramName && contextDocs.length === 0) {
      const byName = await this.contextSourceRepo.findByProgramName(resolvedProgramName);
      if (byName) contextDocs = [byName];
    }

    // Step 3: Run Prompt 7 (multiple programs response)
    const multiIntention = findIntentionByRole(intentions, 'MULTIPLE');
    const multiPrompt = multiIntention ? findPromptForIntention(prompts, multiIntention.id) : undefined;

    if (!multiPrompt || contextDocs.length === 0) {
      if (contextDocs.length === 0) {
        return this.fallbackResult(fallback);
      }
      return this.fallbackResult(fallback);
    }

    // Build programs context from search results + program metadata
    const foundPrograms = contextDocs.map((doc) => {
      const prog = programs.find((p) => p.id === doc.originalId || p.name === doc.programName);
      return {
        name: doc.programName,
        summary: prog?.summary ?? doc.fullTextContent.slice(0, 300),
        modalities: prog?.modalities.map((mod) => ({
          careerType: mod.careerType,
          modalities: mod.modalities,
        })) ?? [],
      };
    });

    const multiCtx: Record<string, unknown> = {
      messages: buildMessagesContext(messages),
      programs: foundPrograms,
    };

    const newProgramName = resolvedProgramName ?? (foundPrograms[0]?.name ?? null);
    return this.compileAndCall(multiPrompt.template, multiCtx, userMessage, fallback, newProgramName);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private buildIdentifyContext(
    messages: ReadonlyArray<Message>,
    _userMessage: string,
    careerId: string | null,
    metaData: ConversationMetaData | null,
    programs: Program[],
    intentions: FunnelIntention[],
  ): Record<string, unknown> {
    return {
      user: {
        careerId: careerId ?? null,
        metaData: metaData
          ? {
              filterType: metaData.filterType ?? null,
              filterValue: Array.isArray(metaData.filterValue)
                ? metaData.filterValue
                : metaData.filterValue ? [metaData.filterValue] : [],
            }
          : { filterType: null, filterValue: [] },
      },
      careers: programs.map((p) => ({
        id: p.id,
        name: p.name,
        modalities: p.modalities.map((mod) => ({
          careerType: mod.careerType,
          modalities: mod.modalities,
        })),
        facultyId: p.facultyId,
        faculty: { name: '' }, // faculty name join would need another query; empty is acceptable for routing
        tags: p.tags,
      })),
      messages: buildMessagesContext(messages),
      intentions: intentions.map((i) => ({ id: i.id, title: i.title, description: i.description })),
    };
  }

  private buildProgramResponseContext(
    messages: ReadonlyArray<Message>,
    fullTextContent: string,
  ): Record<string, unknown> {
    return {
      messages: buildMessagesContext(messages),
      program: { full_text_content: fullTextContent },
    };
  }

  private async getFullTextContent(careerId: string | null, programs: Program[]): Promise<string> {
    if (careerId) {
      const csd = await this.contextSourceRepo.findByProgramId(careerId);
      if (csd) return csd.fullTextContent;
      // Fall back to finding by program name if careerId not in context_source_data
      const prog = programs.find((p) => p.id === careerId);
      if (prog) {
        const csdByName = await this.contextSourceRepo.findByProgramName(prog.name);
        if (csdByName) return csdByName.fullTextContent;
      }
    }
    // No specific program identified — return a general summary of all programs
    return programs
      .slice(0, 10)
      .map((p) => `${p.name}: ${p.summary}`)
      .join('\n\n');
  }

  private async compileAndCall(
    template: string,
    ctx: Record<string, unknown>,
    userMessage: string,
    fallback: { content: string; model: string; totalTokens: number },
    newProgramName: string | null,
  ): Promise<IntentRoutingResult> {
    let compiled: { rendered: string; missingVariables: string[] };
    try {
      compiled = this.templateService.compile(template, ctx);
    } catch (err) {
      logger.error('[IntentRouter] Template compilation failed', { error: err });
      return this.fallbackResult(fallback);
    }

    if (compiled.missingVariables.length > 0) {
      logger.warn('[IntentRouter] Missing template variables', { missing: compiled.missingVariables });
    }

    const msgs: ChatMessage[] = [
      { role: 'system', content: compiled.rendered },
      { role: 'user', content: userMessage },
    ];

    const result = await this.aiProvider.complete(msgs);
    return {
      content: result.content,
      model: result.model,
      totalTokens: result.totalTokens,
      newCareerId: null, // will be overridden in route()
      newMetaData: null,
      newProgramName,
    };
  }

  private fallbackResult(r: { content: string; model: string; totalTokens: number }): IntentRoutingResult {
    return { ...r, newCareerId: null, newMetaData: null, newProgramName: null };
  }

  private resolveRoutingGroup(
    intention: FunnelIntention | undefined,
    rawIntent: string,
    _intentions: FunnelIntention[],
  ): string {
    const typeStr = intention?.type ?? rawIntent;
    for (const group of Object.keys(KEYWORDS)) {
      if (matchesKeywords(typeStr, group)) return group;
    }
    // Try matching raw intent string against keywords
    for (const group of Object.keys(KEYWORDS)) {
      if ((KEYWORDS[group] ?? []).some((kw) => rawIntent.toUpperCase().includes(kw))) return group;
    }
    return 'GENERAL';
  }

  private programMatchesFilter(
    program: Program,
    filterType: string,
    filterValue: string | string[],
  ): boolean {
    const values = Array.isArray(filterValue) ? filterValue : [filterValue];
    const lType = filterType.toLowerCase();

    if (lType === 'facultyid') {
      return values.includes(program.facultyId);
    }
    if (lType === 'types' || lType === 'type') {
      return (program.types as string[]).some((t) => values.includes(t));
    }
    if (lType === 'modalities' || lType === 'modality') {
      const flatModalities = program.modalities.flatMap((m) => m.modalities as string[]);
      return flatModalities.some((m) => values.includes(m));
    }
    if (lType === 'tags' || lType === 'tag') {
      return (program.tags as string[]).some((t) => values.includes(t));
    }
    return false;
  }
}
