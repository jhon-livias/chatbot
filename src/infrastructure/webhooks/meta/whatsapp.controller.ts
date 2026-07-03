import type { Request, Response } from 'express';
import type { HandleIncomingMessageUseCase } from '../../../application/use-cases/handle-incoming-message/handle-incoming-message.usecase.js';
import type {
  MetaWebhookPayload,
  MetaWebhookVerifyQuery,
  ParsedWhatsAppInboundMessage,
} from './meta-whatsapp.types.js';
import type { WhatsAppParserService } from './whatsapp-parser.service.js';
import { logger } from '../../shared/logger.js';
import { formatMetaApiError } from './meta-api-error.js';

/**
 * HTTP controller for Meta WhatsApp webhook verification and inbound messages.
 */
export class WhatsAppController {
  constructor(
    private readonly parser: WhatsAppParserService,
    private readonly handleIncomingMessage: HandleIncomingMessageUseCase,
    private readonly verifyToken: string,
  ) {}

  verify(req: Request, res: Response): void {
    const query = req.query as MetaWebhookVerifyQuery;
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === this.verifyToken) {
      logger.info('[WhatsApp] Webhook verified successfully');
      res.status(200).send(challenge);
      return;
    }

    logger.warn('[WhatsApp] Webhook verification failed', { mode, token });
    res.sendStatus(403);
  }

  receive(req: Request, res: Response): void {
    res.sendStatus(200);

    const payload = req.body as MetaWebhookPayload;
    const inboundMessages = this.parser.parseInboundMessages(payload);

    if (!inboundMessages.length) {
      logger.debug('[WhatsApp] Webhook received with no processable text messages');
      return;
    }

    for (const message of inboundMessages) {
      void this.dispatchToAiFlow(message);
    }
  }

  private async dispatchToAiFlow(message: ParsedWhatsAppInboundMessage): Promise<void> {
    try {
      await this.handleIncomingMessage.execute({
        fromPhoneNumber: this.toE164(message.waId),
        ...(message.profileName !== undefined && { profileName: message.profileName }),
        externalMessageId: message.externalMessageId,
        content: message.text,
        timestamp: message.timestampMs,
      });

      logger.info('[WhatsApp] Message processed', {
        waId: message.waId,
        profileName: message.profileName,
        messageId: message.externalMessageId,
      });
    } catch (err) {
      logger.error('[WhatsApp] Error processing inbound message', {
        waId: message.waId,
        profileName: message.profileName,
        messageId: message.externalMessageId,
        ...formatMetaApiError(err),
      });
    }
  }

  private toE164(waId: string): string {
    return waId.startsWith('+') ? waId : `+${waId}`;
  }
}
