import type { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import type { UserRepository } from '../../../domain/repositories/user.repository.js';
import type { Conversation } from '../../../domain/entities/conversation.entity.js';
import type { FunnelUserMongoRepository } from '../../../infrastructure/database/mongodb/repositories/funnel-user.mongo-repository.js';

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
  contactName: string | null;
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
  constructor(
    private readonly conversationRepo: ConversationRepository,
    private readonly userRepo: UserRepository,
    private readonly funnelUserRepo: FunnelUserMongoRepository,
  ) {}

  async execute(input: ListAgentInboxInput): Promise<ListAgentInboxOutput> {
    const limit = Math.min(input.limit ?? 20, 100);
    const offset = input.offset ?? 0;

    const [conversations, total] = await Promise.all([
      this.conversationRepo.findHumanByAgentId(input.agentId, { limit, offset }),
      this.conversationRepo.countHumanByAgentId(input.agentId),
    ]);

    const phoneNumbers = conversations.map((c) => c.phoneNumber);
    const userIds = conversations.map((c) => c.userId);

    const [funnelNames, userNames] = await Promise.all([
      this.funnelUserRepo.findNamesBySenderIds(phoneNumbers),
      this.userRepo.findNamesByIds(userIds),
    ]);

    return {
      conversations: conversations.map((c) =>
        this.toSummary(c, funnelNames, userNames),
      ),
      total,
      limit,
      offset,
    };
  }

  private toSummary(
    c: Conversation,
    funnelNames: Map<string, string>,
    userNames: Map<string, string>,
  ): ConversationSummary {
    const phoneKey = c.phoneNumber.replace(/^\+/, '');
    const contactName = funnelNames.get(phoneKey) ?? userNames.get(c.userId) ?? null;

    return {
      id: c.id,
      phoneNumber: c.phoneNumber,
      contactName,
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
