import type { Request, Response } from 'express';
import type { HandleIncomingMessageUseCase } from '../../../application/use-cases/handle-incoming-message/handle-incoming-message.usecase.js';
import type {
  MetaWebhookPayload,
  MetaWebhookVerifyQuery,
  ParsedWhatsAppInboundMessage,
} from './meta-whatsapp.types.js';
import type { WhatsAppParserService } from './whatsapp-parser.service.js';
import { logger } from '../../shared/logger.js';

export class WhatsAppController {
  constructor(
    private readonly parser: WhatsAppParserService,
    private readonly handleIncomingMessage: HandleIncomingMessageUseCase,
    private readonly verifyToken: string,
  ) {}

  /** GET /api/webhook/whatsapp — verificación del hub.challenge de Meta */
  verify(req: Request, res: Response): void {
    const query = req.query as MetaWebhookVerifyQuery;
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === this.verifyToken) {
      logger.info('[WhatsApp] Webhook verificado exitosamente');
      res.status(200).send(challenge);
      return;
    }

    logger.warn('[WhatsApp] Verificación del webhook fallida', { mode, token });
    res.sendStatus(403);
  }

  /** POST /api/webhook/whatsapp — recepción de mensajes entrantes */
  receive(req: Request, res: Response): void {
    // Meta requiere 200 OK inmediato para evitar reintentos por timeout
    res.sendStatus(200);

    const payload = req.body as MetaWebhookPayload;
    const inboundMessages = this.parser.parseInboundMessages(payload);

    if (!inboundMessages.length) {
      logger.debug('[WhatsApp] Webhook recibido sin mensajes de texto procesables');
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
        externalMessageId: message.externalMessageId,
        content: message.text,
        timestamp: message.timestampMs,
      });

      logger.info('[WhatsApp] Mensaje procesado', {
        waId: message.waId,
        profileName: message.profileName,
        messageId: message.externalMessageId,
      });
    } catch (err) {
      logger.error('[WhatsApp] Error procesando mensaje entrante', {
        waId: message.waId,
        profileName: message.profileName,
        messageId: message.externalMessageId,
        error: err,
      });
    }
  }

  private toE164(waId: string): string {
    return waId.startsWith('+') ? waId : `+${waId}`;
  }
}
