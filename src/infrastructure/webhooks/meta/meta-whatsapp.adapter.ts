import axios, { type AxiosInstance } from 'axios';
import type {
  MessagingProviderPort,
  OutboundTextMessage,
  OutboundMediaMessage,
  OutboundMessageResult,
} from '../../../application/ports/messaging-provider.port.js';
import { logger } from '../../shared/logger.js';
import { formatMetaApiError } from './meta-api-error.js';
import { formatWhatsAppText, toMetaRecipientId } from './format-whatsapp-text.js';
import type { MetaMediaService } from './meta-media.service.js';

interface MetaConfig {
  token: string;
  phoneNumberId: string;
  apiVersion: string;
  baseUrl: string;
  timeoutMs?: number;
}

interface MetaSendMessageResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

/**
 * Adapter that implements MessagingProviderPort using the Meta WhatsApp Cloud API.
 */
export class MetaWhatsAppAdapter implements MessagingProviderPort {
  private readonly client: AxiosInstance;
  private readonly phoneNumberId: string;
  private readonly mediaService: MetaMediaService | undefined;

  constructor(config: MetaConfig, mediaService?: MetaMediaService) {
    this.phoneNumberId = config.phoneNumberId;
    this.mediaService = mediaService;
    this.client = axios.create({
      baseURL: `${config.baseUrl}/${config.apiVersion}`,
      timeout: config.timeoutMs ?? 10_000,
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async sendTextMessage(message: OutboundTextMessage): Promise<OutboundMessageResult> {
    const to = toMetaRecipientId(message.to);
    const body = formatWhatsAppText(message.body);

    logger.debug('[Meta] Sending text message', { to });

    try {
      const response = await this.client.post<MetaSendMessageResponse>(
        `/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: { preview_url: false, body },
        },
      );

      const messageId = response.data.messages[0]?.id ?? '';
      logger.debug('[Meta] Message sent', { messageId, to });

      return { messageId, status: 'sent' };
    } catch (err) {
      logger.error('[Meta] Failed to send message', {
        to,
        ...formatMetaApiError(err),
      });
      throw err;
    }
  }

  async sendMediaMessage(message: OutboundMediaMessage): Promise<OutboundMessageResult> {
    const to = toMetaRecipientId(message.to);

    logger.debug('[Meta] Sending media message', { to, type: message.type });

    // Build the media object — prefer mediaId over link
    const mediaObject: Record<string, unknown> = {};
    if (message.mediaId) {
      mediaObject['id'] = message.mediaId;
    } else if (message.link) {
      mediaObject['link'] = message.link;
    } else {
      throw new Error('[MetaWhatsAppAdapter] sendMediaMessage requires either mediaId or link');
    }
    if (message.caption) mediaObject['caption'] = message.caption;
    if (message.fileName && message.type === 'document') mediaObject['filename'] = message.fileName;

    try {
      const response = await this.client.post<MetaSendMessageResponse>(
        `/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: message.type,
          [message.type]: mediaObject,
        },
      );

      const messageId = response.data.messages[0]?.id ?? '';
      logger.debug('[Meta] Media message sent', { messageId, to, type: message.type });

      return { messageId, status: 'sent' };
    } catch (err) {
      logger.error('[Meta] Failed to send media message', {
        to,
        type: message.type,
        ...formatMetaApiError(err),
      });
      throw err;
    }
  }

  /** Expose MediaService so use-cases can upload/download without importing infra directly. */
  getMediaService(): MetaMediaService | undefined {
    return this.mediaService;
  }
}
