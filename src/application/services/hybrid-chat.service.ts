import type { AiProviderPort, ChatMessage } from '../ports/ai-provider.port.js';
import type { AcademicToolsService } from '../../infrastructure/ai/tools/academic-tools.service.js';
import { ACADEMIC_TOOLS } from '../../infrastructure/ai/tools/academic-tools.definitions.js';
import { completeWithTools, type ToolLoopResult } from '../../infrastructure/ai/tool-calling-loop.js';
import { withCurrentDateContext } from '../../infrastructure/shared/current-date-context.js';

export type HybridChatResult = ToolLoopResult;

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
    const messages: ChatMessage[] = [
      { role: 'system', content: withCurrentDateContext(this.systemPrompt) },
      ...history,
    ];
    return completeWithTools(this.aiProvider, messages, ACADEMIC_TOOLS, (name, args) =>
      this.toolsService.execute(name, args),
    );
  }
}
