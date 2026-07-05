import type { MessageRepository } from '../../../domain/repositories/message.repository.js';
import { logger } from '../../../infrastructure/shared/logger.js';

export interface HandleMessageStatusInput {
  externalMessageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestampMs: number;
}

export interface HandleMessageStatusOutput {
  updated: boolean;
  messageId?: string;
  conversationId?: string;
  status?: string;
}

/**
 * Processes Meta WhatsApp delivery/read webhook statuses and updates persisted messages.
 */
export class HandleMessageStatusUseCase {
  constructor(private readonly messageRepo: MessageRepository) {}

  async execute(input: HandleMessageStatusInput): Promise<HandleMessageStatusOutput> {
    const message = await this.messageRepo.findByExternalId(input.externalMessageId);
    if (!message) {
      logger.debug('[HandleMessageStatus] Message not found for externalId', {
        externalMessageId: input.externalMessageId,
        status: input.status,
      });
      return { updated: false };
    }

    const timestamp = new Date(input.timestampMs);
    const updatedMessage = message.applyStatusUpdate(input.status, timestamp);
    if (!updatedMessage) {
      logger.debug('[HandleMessageStatus] Status not advanced', {
        messageId: message.id.value,
        currentStatus: message.status,
        incomingStatus: input.status,
      });
      return {
        updated: false,
        messageId: message.id.value,
        conversationId: message.conversationId,
        status: message.status,
      };
    }

    await this.messageRepo.save(updatedMessage);

    logger.info('[HandleMessageStatus] Message status updated', {
      messageId: updatedMessage.id.value,
      conversationId: updatedMessage.conversationId,
      status: updatedMessage.status,
      externalMessageId: input.externalMessageId,
    });

    return {
      updated: true,
      messageId: updatedMessage.id.value,
      conversationId: updatedMessage.conversationId,
      status: updatedMessage.status,
    };
  }
}
