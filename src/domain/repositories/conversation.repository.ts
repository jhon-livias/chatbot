import type { Conversation } from '../entities/conversation.entity.js';

export interface ConversationRepository {
  findById(id: string): Promise<Conversation | null>;
  findActiveByPhoneNumber(phoneNumber: string): Promise<Conversation | null>;
  findByUserId(userId: string): Promise<Conversation[]>;
  save(conversation: Conversation): Promise<Conversation>;
  delete(id: string): Promise<void>;
}
