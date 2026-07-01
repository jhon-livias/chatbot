import type { Request, Response } from 'express';
import type { HandleIncomingMessageUseCase } from '../../../application/use-cases/handle-incoming-message/handle-incoming-message.usecase.js';
import type { MetaWebhookPayload } from './meta-whatsapp.types.js';
import { logger } from '../../shared/logger.js';

export class MetaWhatsAppController {
  constructor(
    private readonly handleIncomingMessage: HandleIncomingMessageUseCase,
    private readonly verifyToken: string,
  ) {}

  /** GET /webhook — verificación del webhook por Meta */
  verify(req: Request, res: Response): void {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === this.verifyToken) {
      logger.info('[Meta] Webhook verificado exitosamente');
      res.status(200).send(challenge);
      return;
    }

    logger.warn('[Meta] Verificación del webhook fallida', { mode, token });
    res.sendStatus(403);
  }

  /** POST /webhook — recepción de mensajes entrantes */
  async receive(req: Request, res: Response): Promise<void> {
    // Meta requiere respuesta 200 inmediata para evitar reintentos
    res.sendStatus(200);

    const payload = req.body as MetaWebhookPayload;

    if (payload.object !== 'whatsapp_business_account') return;

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const messages = change.value.messages;
        if (!messages?.length) continue;

        for (const message of messages) {
          if (message.type !== 'text' || !message.text?.body) continue;

          try {
            await this.handleIncomingMessage.execute({
              fromPhoneNumber: `+${message.from}`,
              externalMessageId: message.id,
              content: message.text.body,
              timestamp: parseInt(message.timestamp, 10) * 1000,
            });
          } catch (err) {
            logger.error('[Meta] Error procesando mensaje entrante', {
              messageId: message.id,
              error: err,
            });
          }
        }
      }
    }
  }
}
