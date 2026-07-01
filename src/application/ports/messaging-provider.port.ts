export interface OutboundTextMessage {
  to: string;
  body: string;
}

export interface OutboundMessageResult {
  messageId: string;
  status: string;
}

/** Puerto que desacopla la capa de aplicación de cualquier proveedor de mensajería (WhatsApp, SMS, etc.) */
export interface MessagingProviderPort {
  sendTextMessage(message: OutboundTextMessage): Promise<OutboundMessageResult>;
}
