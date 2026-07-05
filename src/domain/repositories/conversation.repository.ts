import type { Conversation } from '../entities/conversation.entity.js';

export interface ConversationRepository {
  findById(id: string): Promise<Conversation | null>;
  findActiveByPhoneNumber(phoneNumber: string): Promise<Conversation | null>;
  findByUserId(userId: string): Promise<Conversation[]>;
  /** Returns paginated human-mode conversations assigned to the given agent (no messages loaded). */
  findHumanByAgentId(
    agentId: string,
    opts: { limit: number; offset: number },
  ): Promise<Conversation[]>;
  countHumanByAgentId(agentId: string): Promise<number>;
  /** Latest conversation per phone (prefers active, then most recently updated). */
  findLatestByPhoneNumbers(phoneNumbers: string[]): Promise<Map<string, Conversation>>;
  save(conversation: Conversation): Promise<Conversation>;
  delete(id: string): Promise<void>;
}
