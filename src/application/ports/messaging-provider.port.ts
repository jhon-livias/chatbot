export interface OutboundTextMessage {
  to: string;
  body: string;
}

export interface OutboundMessageResult {
  messageId: string;
  status: string;
}

/**
 * Port that decouples the application layer from any messaging provider (WhatsApp, SMS, etc.).
 */
export interface MessagingProviderPort {
  sendTextMessage(message: OutboundTextMessage): Promise<OutboundMessageResult>;
}
