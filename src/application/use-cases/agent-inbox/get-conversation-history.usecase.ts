import type { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import type { UserRepository } from '../../../domain/repositories/user.repository.js';
import type { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import type { AgentRole } from '../../../domain/entities/agent.entity.js';
import {
  assertCanViewConversation,
  ForbiddenError,
} from '../../services/conversation-access.service.js';
import type { Message } from '../../../domain/entities/message.entity.js';
import type { FunnelUserMongoRepository } from '../../../infrastructure/database/mongodb/repositories/funnel-user.mongo-repository.js';

export { ForbiddenError };

export interface GetConversationHistoryInput {
  conversationId: string;
  agentId: string;
  role?: AgentRole;
  limit?: number | undefined;
}

export interface MessageDto {
  id: string;
  role: string;
  content: string;
  status: string;
  timestamp: Date;
  externalId?: string;
  metadata?: Record<string, unknown>;
}

export interface GetConversationHistoryOutput {
  conversationId: string;
  phoneNumber: string;
  contactName: string | null;
  userId: string;
  mode: string;
  status: string;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  unreadCountAgent: number;
  messages: MessageDto[];
}

export class GetConversationHistoryUseCase {
  constructor(
    private readonly conversationRepo: ConversationRepository,
    private readonly userRepo: UserRepository,
    private readonly funnelUserRepo: FunnelUserMongoRepository,
    private readonly agentRepo: AgentRepository,
  ) {}

  async execute(input: GetConversationHistoryInput): Promise<GetConversationHistoryOutput> {
    const conversation = await this.conversationRepo.findById(input.conversationId);
    if (!conversation) {
      throw new Error('Conversación no encontrada');
    }

    assertCanViewConversation(conversation, input.agentId, input.role ?? 'agent');

    const msgs: ReadonlyArray<Message> =
      input.limit !== undefined && input.limit > 0
        ? conversation.getLastNMessages(input.limit)
        : input.limit === 0
          ? []
          : conversation.messages;

    const [funnelUser, user, assignedAgent] = await Promise.all([
      this.funnelUserRepo.findBySenderId(conversation.phoneNumber),
      this.userRepo.findById(conversation.userId),
      conversation.assignedAgentId
        ? this.agentRepo.findById(conversation.assignedAgentId)
        : Promise.resolve(null),
    ]);
    const contactName = funnelUser?.name ?? user?.name ?? null;

    return {
      conversationId: conversation.id,
      phoneNumber: conversation.phoneNumber,
      contactName,
      userId: conversation.userId,
      mode: conversation.mode,
      status: conversation.status,
      assignedAgentId: conversation.assignedAgentId,
      assignedAgentName: assignedAgent?.name ?? null,
      unreadCountAgent: conversation.unreadCountAgent,
      messages: msgs.map((m) => ({
        id: m.id.value,
        role: m.role,
        content: m.content,
        status: m.status,
        timestamp: m.timestamp,
        ...(m.externalId !== undefined && { externalId: m.externalId }),
        ...(m.metadata !== undefined && { metadata: m.metadata }),
      })),
    };
  }
}
