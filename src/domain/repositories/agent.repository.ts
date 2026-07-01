import type { Agent } from '../entities/agent.entity.js';

/**
 * Persistence port for Agent aggregate roots.
 */
export interface AgentRepository {
  findById(id: string): Promise<Agent | null>;
  findAll(): Promise<Agent[]>;
  findActive(): Promise<Agent[]>;
  findByUserId(userId: string): Promise<Agent[]>;
  save(agent: Agent): Promise<Agent>;
  delete(id: string): Promise<void>;
}
