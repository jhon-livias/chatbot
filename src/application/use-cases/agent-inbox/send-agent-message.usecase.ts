import type { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import type { MessagingProviderPort } from '../../ports/messaging-provider.port.js';
import type { FunnelMessageMongoRepository } from '../../../infrastructure/database/mongodb/repositories/funnel-message.mongo-repository.js';
import { Message } from '../../../domain/entities/message.entity.js';
import { MessageId } from '../../../domain/value-objects/message-id.vo.js';
import {
  assertAgentOwnsConversation,
  ForbiddenError,
} from '../../services/conversation-access.service.js';

export { ForbiddenError };

export interface SendAgentMessageInput {
  conversationId: string;
  agentId: string;
  content: string;
}

export interface SendAgentMessageOutput {
  messageId: string;
  status: string;
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export class SendAgentMessageUseCase {
  constructor(
    private readonly conversationRepo: ConversationRepository,
    private readonly messagingProvider: MessagingProviderPort,
    private readonly funnelMessageRepo: FunnelMessageMongoRepository,
  ) {}

  async execute(input: SendAgentMessageInput): Promise<SendAgentMessageOutput> {
    const conversation = await this.conversationRepo.findById(input.conversationId);
    if (!conversation) {
      throw new Error('Conversación no encontrada');
    }

    assertAgentOwnsConversation(conversation, input.agentId);

    if (!conversation.isHumanMode()) {
      throw new Error('La conversación no está en modo humano');
    }

    const now = new Date();
    if (
      !conversation.lastUserMessageAt ||
      now.getTime() - conversation.lastUserMessageAt.getTime() > TWENTY_FOUR_HOURS_MS
    ) {
      throw new Error(
        'Ventana de 24 horas expirada. El lead debe escribir primero para reabrir la ventana.',
      );
    }

    const result = await this.messagingProvider.sendTextMessage({
      to: conversation.phoneNumber,
      body: input.content,
    });

    const agentMsg = Message.create({
      id: MessageId.generate(),
      conversationId: conversation.id,
      externalId: result.messageId,
      role: 'agent',
      content: input.content,
      status: 'sent',
      timestamp: now,
      metadata: { agentId: input.agentId },
    });

    const updated = conversation
      .addMessage(agentMsg)
      .withLastAgentMessageAt(now);

    await this.conversationRepo.save(updated);

    await this.funnelMessageRepo.saveAgentMessage({
      funnelUserId: conversation.userId,
      text: input.content,
      agentId: input.agentId,
    });

    return { messageId: result.messageId, status: 'sent' };
  }
}
