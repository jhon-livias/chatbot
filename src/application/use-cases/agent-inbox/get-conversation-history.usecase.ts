import type { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import { assertAgentOwnsConversation, ForbiddenError } from '../../services/conversation-access.service.js';
import type { Message } from '../../../domain/entities/message.entity.js';

export { ForbiddenError };

export interface GetConversationHistoryInput {
  conversationId: string;
  agentId: string;
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
  userId: string;
  mode: string;
  status: string;
  assignedAgentId: string | null;
  unreadCountAgent: number;
  messages: MessageDto[];
}

export class GetConversationHistoryUseCase {
  constructor(private readonly conversationRepo: ConversationRepository) {}

  async execute(input: GetConversationHistoryInput): Promise<GetConversationHistoryOutput> {
    const conversation = await this.conversationRepo.findById(input.conversationId);
    if (!conversation) {
      throw new Error('Conversación no encontrada');
    }

    assertAgentOwnsConversation(conversation, input.agentId);

    const msgs: ReadonlyArray<Message> =
      input.limit !== undefined && input.limit > 0
        ? conversation.getLastNMessages(input.limit)
        : input.limit === 0
          ? []
          : conversation.messages;

    return {
      conversationId: conversation.id,
      phoneNumber: conversation.phoneNumber,
      userId: conversation.userId,
      mode: conversation.mode,
      status: conversation.status,
      assignedAgentId: conversation.assignedAgentId,
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
