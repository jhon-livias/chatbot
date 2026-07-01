export interface HandleIncomingMessageDto {
  fromPhoneNumber: string;
  externalMessageId: string;
  content: string;
  timestamp: number;
}

export interface HandleIncomingMessageResult {
  conversationId: string;
  userMessageId: string;
  aiResponseId: string;
  aiResponseContent: string;
}
