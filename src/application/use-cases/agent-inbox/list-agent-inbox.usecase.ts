import type { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import type { UserRepository } from '../../../domain/repositories/user.repository.js';
import type { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import type { AgentRole } from '../../../domain/entities/agent.entity.js';
import type { Conversation } from '../../../domain/entities/conversation.entity.js';
import type { FunnelUserMongoRepository } from '../../../infrastructure/database/mongodb/repositories/funnel-user.mongo-repository.js';

export interface ListAgentInboxInput {
  agentId: string;
  role?: AgentRole;
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
  assignedAgentName: string | null;
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
    private readonly agentRepo: AgentRepository,
  ) {}

  async execute(input: ListAgentInboxInput): Promise<ListAgentInboxOutput> {
    const limit = Math.min(input.limit ?? 20, 100);
    const offset = input.offset ?? 0;
    const isAdmin = input.role === 'admin';

    const [conversations, total] = await Promise.all([
      isAdmin
        ? this.conversationRepo.findAllActiveForInbox({ limit, offset })
        : this.conversationRepo.findHumanByAgentId(input.agentId, { limit, offset }),
      isAdmin
        ? this.conversationRepo.countAllActiveForInbox()
        : this.conversationRepo.countHumanByAgentId(input.agentId),
    ]);

    const phoneNumbers = conversations.map((c) => c.phoneNumber);
    const userIds = conversations.map((c) => c.userId);
    const assignedAgentIds = [
      ...new Set(
        conversations.map((c) => c.assignedAgentId).filter((id): id is string => id !== null),
      ),
    ];

    const [funnelNames, userNames, agentNames] = await Promise.all([
      this.funnelUserRepo.findNamesBySenderIds(phoneNumbers),
      this.userRepo.findNamesByIds(userIds),
      this.agentRepo.findNamesByIds(assignedAgentIds),
    ]);

    return {
      conversations: conversations.map((c) =>
        this.toSummary(c, funnelNames, userNames, agentNames),
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
    agentNames: Map<string, string>,
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
      assignedAgentName: c.assignedAgentId ? (agentNames.get(c.assignedAgentId) ?? null) : null,
      handoffAt: c.handoffAt,
      lastUserMessageAt: c.lastUserMessageAt,
      lastAgentMessageAt: c.lastAgentMessageAt,
      updatedAt: c.updatedAt,
      createdAt: c.createdAt,
    };
  }
}
