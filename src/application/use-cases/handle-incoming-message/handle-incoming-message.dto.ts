export interface HandleIncomingMessageDto {
  fromPhoneNumber: string;
  /** WhatsApp profile display name from Meta webhook contacts[].profile.name */
  profileName?: string;
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
