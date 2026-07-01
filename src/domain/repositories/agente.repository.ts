import type { Agente } from '../entities/agente.entity.js';

export interface AgenteRepository {
  findById(id: string): Promise<Agente | null>;
  findAll(): Promise<Agente[]>;
  findActivos(): Promise<Agente[]>;
  findByUserId(userId: string): Promise<Agente[]>;
  save(agente: Agente): Promise<Agente>;
  delete(id: string): Promise<void>;
}
