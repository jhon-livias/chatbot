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

/** Puerto (interfaz) que desacopla la capa de aplicación de cualquier proveedor de IA */
export interface AiProviderPort {
  complete(messages: ChatMessage[], options?: AiCompletionOptions): Promise<AiCompletionResult>;
}
