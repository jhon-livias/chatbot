export interface HandleIncomingMessageDto {
  /** Número de teléfono en formato E.164 del remitente */
  fromPhoneNumber: string;
  /** ID externo del mensaje (proporcionado por la API de WhatsApp) */
  externalMessageId: string;
  /** Texto recibido */
  content: string;
  /** Timestamp del mensaje en Unix epoch (ms) */
  timestamp: number;
}

export interface HandleIncomingMessageResult {
  conversationId: string;
  userMessageId: string;
  aiResponseId: string;
  aiResponseContent: string;
}
