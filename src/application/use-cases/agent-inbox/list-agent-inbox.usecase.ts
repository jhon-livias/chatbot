import type { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import type { UserRepository } from '../../../domain/repositories/user.repository.js';
import type { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import type { AgentRole } from '../../../domain/entities/agent.entity.js';
import type { Conversation } from '../../../domain/entities/conversation.entity.js';
import type { FunnelUserMongoRepository } from '../../../infrastructure/database/mongodb/repositories/funnel-user.mongo-repository.js';
import { startOfCurrentMonth } from '../../../infrastructure/shared/start-of-month.js';

export interface ListAgentInboxInput {
  agentId: string;
  role?: AgentRole;
  limit?: number;
  offset?: number;
  /** Admin only — ISO date; defaults to start of current month (America/Lima). */
  since?: Date;
  /** Agent inbox scope: own assigned chats (default) or bot-mode for review. */
  inboxFilter?: 'own' | 'bot';
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
    const isAdmin = input.role === 'admin';
    const defaultLimit = isAdmin ? 100 : 20;
    const maxLimit = isAdmin ? 200 : 100;
    const limit = Math.min(input.limit ?? defaultLimit, maxLimit);
    const offset = input.offset ?? 0;

    if (isAdmin) {
      return this.listAdminInbox(input, limit, offset);
    }

    const since = input.since ?? startOfCurrentMonth();
    const inboxFilter = input.inboxFilter ?? 'own';

    if (inboxFilter === 'bot') {
      const [conversations, total] = await Promise.all([
        this.conversationRepo.findBotModeForInbox({ since, limit, offset }),
        this.conversationRepo.countBotModeForInbox(since),
      ]);
      return this.buildOutput(conversations, total, limit, offset);
    }

    const [conversations, total] = await Promise.all([
      this.conversationRepo.findHumanByAgentId(input.agentId, { limit, offset }),
      this.conversationRepo.countHumanByAgentId(input.agentId),
    ]);

    return this.buildOutput(conversations, total, limit, offset);
  }

  private async listAdminInbox(
    input: ListAgentInboxInput,
    limit: number,
    offset: number,
  ): Promise<ListAgentInboxOutput> {
    const since = input.since ?? startOfCurrentMonth();

    const [funnelLeads, total] = await Promise.all([
      this.funnelUserRepo.findForAdminInbox({ since, limit, offset }),
      this.funnelUserRepo.countForAdminInbox(since),
    ]);

    const phoneKeys = funnelLeads.map((f) => this.normalizePhone(f.senderId));
    const convMap = await this.conversationRepo.findLatestByPhoneNumbers(phoneKeys);

    const conversations: Conversation[] = [];
    const funnelNames = new Map<string, string>();

    for (const lead of funnelLeads) {
      const key = this.normalizePhone(lead.senderId);
      const conv = convMap.get(key);
      if (!conv) continue;
      conversations.push(conv);
      if (lead.name?.trim()) funnelNames.set(key, lead.name.trim());
    }

    const output = await this.buildOutput(conversations, total, limit, offset, funnelNames);
    return output;
  }

  private async buildOutput(
    conversations: Conversation[],
    total: number,
    limit: number,
    offset: number,
    presetFunnelNames?: Map<string, string>,
  ): Promise<ListAgentInboxOutput> {
    const phoneNumbers = conversations.map((c) => c.phoneNumber);
    const userIds = conversations.map((c) => c.userId);
    const assignedAgentIds = [
      ...new Set(
        conversations.map((c) => c.assignedAgentId).filter((id): id is string => id !== null),
      ),
    ];

    const [funnelNamesLookup, userNames, agentNames] = await Promise.all([
      presetFunnelNames
        ? Promise.resolve(presetFunnelNames)
        : this.funnelUserRepo.findNamesBySenderIds(phoneNumbers),
      this.userRepo.findNamesByIds(userIds),
      this.agentRepo.findNamesByIds(assignedAgentIds),
    ]);

    const funnelNames = presetFunnelNames ?? funnelNamesLookup;

    return {
      conversations: conversations.map((c) =>
        this.toSummary(c, funnelNames, userNames, agentNames),
      ),
      total,
      limit,
      offset,
    };
  }

  private normalizePhone(value: string): string {
    return value.trim().replace(/^\+/, '');
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
