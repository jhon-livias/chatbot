import type { Prompt } from '../entities/prompt.entity.js';

export interface PromptRepository {
  findById(id: string): Promise<Prompt | null>;
  /** Retorna el prompt activo para la combinación funnel + intención */
  findActiveByFunnelAndIntention(
    funnelId: string,
    intentionId: string,
  ): Promise<Prompt | null>;
  /** Retorna todos los prompts de una intención */
  findByIntentionId(intentionId: string): Promise<Prompt[]>;
  findByFunnelId(funnelId: string): Promise<Prompt[]>;
  findActivos(): Promise<Prompt[]>;
  save(prompt: Prompt): Promise<Prompt>;
  delete(id: string): Promise<void>;
}
