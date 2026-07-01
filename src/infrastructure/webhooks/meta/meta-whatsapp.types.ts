/** Tipos que modela el payload de entrada del Webhook de Meta WhatsApp Cloud API */

/** Query params enviados por Meta en GET /webhook durante la verificación del hub */
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

export interface MetaInboundMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'image' | 'audio' | 'document' | 'video' | 'location' | 'interactive';
  text?: { body: string };
}

export interface MetaMessageStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
}

/** Mensaje entrante normalizado tras parsear el payload anidado de Meta */
export interface ParsedWhatsAppInboundMessage {
  /** WhatsApp ID del usuario (wa_id / message.from) */
  waId: string;
  /** Nombre público del perfil de WhatsApp, si Meta lo incluye en contacts */
  profileName?: string;
  /** Cuerpo del mensaje de texto: messages[n].text.body */
  text: string;
  externalMessageId: string;
  timestampMs: number;
}
