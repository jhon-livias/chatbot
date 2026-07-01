import type { Prompt } from '../entities/prompt.entity.js';
import type { FunnelEtapa } from '../enums/funnel-etapa.enum.js';

export interface PromptRepository {
  findById(id: string): Promise<Prompt | null>;
  /** Retorna el prompt activo para la combinación funnel + intención */
  findActivoByFunnelAndIntencion(
    funnel: FunnelEtapa,
    intencionId: string,
  ): Promise<Prompt | null>;
  /** Retorna todos los prompts (activos e inactivos) de una intención */
  findByIntencion(intencionId: string): Promise<Prompt[]>;
  findByFunnel(funnel: FunnelEtapa): Promise<Prompt[]>;
  save(prompt: Prompt): Promise<Prompt>;
  delete(id: string): Promise<void>;
}
