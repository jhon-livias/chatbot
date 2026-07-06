export interface MetaWebhookVerifyQuery {
  'hub.mode'?: string;
  'hub.verify_token'?: string;
  'hub.challenge'?: string;
}

export interface MetaWebhookPayload {
  object: 'whatsapp_business_account';
  entry: MetaWebhookEntry[];
}

export interface MetaWebhookEntry {
  id: string;
  changes: MetaWebhookChange[];
}

export interface MetaWebhookChange {
  value: MetaWebhookValue;
  field: 'messages';
}

export interface MetaWebhookValue {
  messaging_product: 'whatsapp';
  metadata: { display_phone_number: string; phone_number_id: string };
  contacts?: MetaContact[];
  messages?: MetaInboundMessage[];
  statuses?: MetaMessageStatus[];
}

export interface MetaContact {
  profile: { name: string };
  wa_id: string;
}

export interface MetaMediaObject {
  id: string;
  mime_type?: string;
  sha256?: string;
  caption?: string;
}

export interface MetaDocumentObject extends MetaMediaObject {
  filename?: string;
}

export interface MetaInboundMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'image' | 'audio' | 'document' | 'video' | 'location' | 'interactive' | 'sticker';
  text?: { body: string };
  image?: MetaMediaObject;
  document?: MetaDocumentObject;
  audio?: MetaMediaObject;
  video?: MetaMediaObject;
  sticker?: MetaMediaObject;
}

export interface MetaMessageStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
}

/**
 * Normalized inbound WhatsApp message after parsing Meta webhook payload.
 */
export type ParsedMessageContentType =
  | 'text'
  | 'image'
  | 'document'
  | 'audio'
  | 'video'
  | 'sticker';

export interface ParsedWhatsAppInboundMessage {
  waId: string;
  profileName?: string;
  text: string;
  externalMessageId: string;
  timestampMs: number;
  contentType: ParsedMessageContentType;
  mediaId?: string;
  mimeType?: string;
  fileName?: string;
  caption?: string;
}

/**
 * Normalized Meta message status update (delivery/read receipts).
 */
export interface ParsedWhatsAppStatusUpdate {
  externalMessageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestampMs: number;
  recipientId: string;
}
