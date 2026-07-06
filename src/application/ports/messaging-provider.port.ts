export interface OutboundTextMessage {
  to: string;
  body: string;
}

export interface OutboundMediaMessage {
  to: string;
  type: 'image' | 'document' | 'audio' | 'video';
  /** Use mediaId (uploaded to Meta) or link (public URL), not both */
  mediaId?: string;
  link?: string;
  caption?: string;
  fileName?: string;
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
  sendMediaMessage(message: OutboundMediaMessage): Promise<OutboundMessageResult>;
}
