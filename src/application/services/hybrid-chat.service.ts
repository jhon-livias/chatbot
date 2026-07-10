import type { AiProviderPort, ChatMessage } from '../ports/ai-provider.port.js';
import type { AcademicToolsService } from '../../infrastructure/ai/tools/academic-tools.service.js';
import { ACADEMIC_TOOLS } from '../../infrastructure/ai/tools/academic-tools.definitions.js';
import { logger } from '../../infrastructure/shared/logger.js';

/** Safety net against infinite tool-call loops (a misbehaving model re-calling tools forever). */
const MAX_TOOL_ROUNDS = 4;

export interface ExecutedToolCall {
  name: string;
  arguments: string;
}

export interface HybridChatResult {
  content: string;
  model: string;
  totalTokens: number;
  toolCallsExecuted: ExecutedToolCall[];
}

/**
 * Orchestrates a single chat turn using the hybrid architecture:
 *  1. Static institutional knowledge lives in the system prompt (injected by the caller).
 *  2. Dynamic data (costs, curriculum) is NEVER put in the prompt — the model must
 *     request it via tool calling, and this service executes the tool against MongoDB
 *     and feeds the hard data back to the model for the final answer.
 */
export class HybridChatService {
  constructor(
    private readonly aiProvider: AiProviderPort,
    private readonly toolsService: AcademicToolsService,
    private readonly systemPrompt: string,
  ) {}

  /**
   * @param history Prior conversation turns (role: 'user' | 'assistant'), oldest first.
   *                Do NOT include the system prompt — it is injected here.
   */
  async chat(history: ChatMessage[]): Promise<HybridChatResult> {
    const messages: ChatMessage[] = [{ role: 'system', content: this.systemPrompt }, ...history];
    let totalTokens = 0;
    const toolCallsExecuted: ExecutedToolCall[] = [];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const result = await this.aiProvider.complete(messages, {
        tools: ACADEMIC_TOOLS,
        toolChoice: 'auto',
      });
      totalTokens += result.totalTokens;

      if (!result.toolCalls || result.toolCalls.length === 0) {
        return { content: result.content, model: result.model, totalTokens, toolCallsExecuted };
      }

      logger.info('[HybridChat] Model requested tool call(s)', {
        round,
        tools: result.toolCalls.map((c) => c.function.name),
      });

      messages.push({ role: 'assistant', content: result.content, tool_calls: result.toolCalls });

      for (const call of result.toolCalls) {
        const toolResult = await this.toolsService.execute(call.function.name, call.function.arguments);
        toolCallsExecuted.push({ name: call.function.name, arguments: call.function.arguments });
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          name: call.function.name,
          content: toolResult,
        });
      }
    }

    // Loop guard tripped — force one last completion without tool access so the
    // user always gets an answer instead of a silent failure.
    logger.warn('[HybridChat] Max tool-call rounds reached — forcing final answer without tools', {
      maxRounds: MAX_TOOL_ROUNDS,
    });
    const finalResult = await this.aiProvider.complete(messages);
    totalTokens += finalResult.totalTokens;
    return { content: finalResult.content, model: finalResult.model, totalTokens, toolCallsExecuted };
  }
}
