import type {
  MetaContact,
  MetaInboundMessage,
  MetaWebhookPayload,
  MetaWebhookValue,
  ParsedWhatsAppInboundMessage,
} from './meta-whatsapp.types.js';

/**
 * Parses nested Meta WhatsApp Cloud API webhook payloads into normalized messages.
 */
export class WhatsAppParserService {
  parseInboundMessages(payload: MetaWebhookPayload): ParsedWhatsAppInboundMessage[] {
    if (payload.object !== 'whatsapp_business_account') {
      return [];
    }

    const messages: ParsedWhatsAppInboundMessage[] = [];

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        messages.push(...this.parseChangeValue(change.value));
      }
    }

    return messages;
  }

  parseFirstInboundMessage(payload: MetaWebhookPayload): ParsedWhatsAppInboundMessage | null {
    const entry = payload.entry[0];
    const change = entry?.changes[0];
    const value = change?.value;

    if (!value?.messages?.length) {
      return null;
    }

    const message = value.messages[0];
    if (!message || message.type !== 'text' || !message.text?.body) {
      return null;
    }

    return this.buildParsedMessage(value, {
      ...message,
      text: { body: message.text.body },
    });
  }

  private parseChangeValue(value: MetaWebhookValue): ParsedWhatsAppInboundMessage[] {
    const inbound = value.messages;
    if (!inbound?.length) {
      return [];
    }

    return inbound
      .filter((message): message is MetaInboundMessage & { text: { body: string } } =>
        message.type === 'text' && Boolean(message.text?.body),
      )
      .map((message) => this.buildParsedMessage(value, message));
  }

  private buildParsedMessage(
    value: MetaWebhookValue,
    message: MetaInboundMessage & { text: { body: string } },
  ): ParsedWhatsAppInboundMessage {
    const waId = message.from;
    const profileName = this.resolveProfileName(value.contacts, waId);

    return {
      waId,
      ...(profileName !== undefined && { profileName }),
      text: message.text.body,
      externalMessageId: message.id,
      timestampMs: Number.parseInt(message.timestamp, 10) * 1000,
    };
  }

  private resolveProfileName(contacts: MetaContact[] | undefined, waId: string): string | undefined {
    const contact = contacts?.find((item) => item.wa_id === waId);
    return contact?.profile.name;
  }
}
