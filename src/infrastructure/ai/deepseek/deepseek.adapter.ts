import axios, { type AxiosInstance } from 'axios';
import type {
  AiProviderPort,
  ChatMessage,
  AiCompletionOptions,
  AiCompletionResult,
} from '../../../application/ports/ai-provider.port.js';
import type { DeepSeekConfig } from './deepseek.config.js';
import { logger } from '../../shared/logger.js';

interface DeepSeekResponseChoice {
  message: { role: string; content: string };
  finish_reason: string;
}

interface DeepSeekApiResponse {
  id: string;
  model: string;
  choices: DeepSeekResponseChoice[];
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

/** Adaptador que implementa AiProviderPort usando la API de DeepSeek */
export class DeepSeekAdapter implements AiProviderPort {
  private readonly client: AxiosInstance;
  private readonly config: DeepSeekConfig;

  constructor(config: DeepSeekConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeoutMs,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async complete(
    messages: ChatMessage[],
    options?: AiCompletionOptions,
  ): Promise<AiCompletionResult> {
    const model = options?.model ?? this.config.model;

    logger.debug('[DeepSeek] Enviando solicitud', {
      model,
      messageCount: messages.length,
    });

    const response = await this.client.post<DeepSeekApiResponse>('/chat/completions', {
      model,
      messages,
      max_tokens: options?.maxTokens ?? this.config.maxTokens,
      temperature: options?.temperature ?? this.config.temperature,
      stream: options?.stream ?? false,
    });

    const choice = response.data.choices[0];
    if (!choice) {
      throw new Error('[DeepSeek] La API no devolvió ninguna opción de respuesta');
    }

    logger.debug('[DeepSeek] Respuesta recibida', {
      tokens: response.data.usage.total_tokens,
      finishReason: choice.finish_reason,
    });

    return {
      content: choice.message.content,
      model: response.data.model,
      promptTokens: response.data.usage.prompt_tokens,
      completionTokens: response.data.usage.completion_tokens,
      totalTokens: response.data.usage.total_tokens,
    };
  }
}
