import type { MessageContentType } from '../../../domain/entities/message.entity.js';

export interface HandleIncomingMessageDto {
  fromPhoneNumber: string;
  /** WhatsApp profile display name from Meta webhook contacts[].profile.name */
  profileName?: string;
  externalMessageId: string;
  content: string;
  timestamp: number;
  contentType?: MessageContentType;
  mediaId?: string;
  mimeType?: string;
  fileName?: string;
  caption?: string;
}

export interface HandleIncomingMessageResult {
  conversationId: string;
  userMessageId: string;
  aiResponseId: string;
  aiResponseContent: string;
}
