export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiCompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface AiCompletionResult {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Port that decouples the application layer from any AI provider.
 */
export interface AiProviderPort {
  complete(messages: ChatMessage[], options?: AiCompletionOptions): Promise<AiCompletionResult>;
}
