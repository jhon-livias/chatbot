import type { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import type { Conversation } from '../../../domain/entities/conversation.entity.js';

export interface ListAgentInboxInput {
  agentId: string;
  limit?: number;
  offset?: number;
}

export interface ListAgentInboxOutput {
  conversations: ConversationSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface ConversationSummary {
  id: string;
  phoneNumber: string;
  userId: string;
  status: string;
  mode: string;
  unreadCountAgent: number;
  assignedAgentId: string | null;
  handoffAt: Date | null;
  lastUserMessageAt: Date | null;
  lastAgentMessageAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
}

export class ListAgentInboxUseCase {
  constructor(private readonly conversationRepo: ConversationRepository) {}

  async execute(input: ListAgentInboxInput): Promise<ListAgentInboxOutput> {
    const limit = Math.min(input.limit ?? 20, 100);
    const offset = input.offset ?? 0;

    const [conversations, total] = await Promise.all([
      this.conversationRepo.findHumanByAgentId(input.agentId, { limit, offset }),
      this.conversationRepo.countHumanByAgentId(input.agentId),
    ]);

    return {
      conversations: conversations.map(this.toSummary),
      total,
      limit,
      offset,
    };
  }

  private toSummary(c: Conversation): ConversationSummary {
    return {
      id: c.id,
      phoneNumber: c.phoneNumber,
      userId: c.userId,
      status: c.status,
      mode: c.mode,
      unreadCountAgent: c.unreadCountAgent,
      assignedAgentId: c.assignedAgentId,
      handoffAt: c.handoffAt,
      lastUserMessageAt: c.lastUserMessageAt,
      lastAgentMessageAt: c.lastAgentMessageAt,
      updatedAt: c.updatedAt,
      createdAt: c.createdAt,
    };
  }
}
