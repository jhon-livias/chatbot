import { Schema, model, type Document } from 'mongoose';

export type MessageRole = 'user' | 'assistant' | 'system' | 'agent';
export type MessageStatus = 'received' | 'processing' | 'sent' | 'failed' | 'read';

export interface MessageDocument extends Document<string> {
  conversationId: string;
  externalId?: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

const messageSchema = new Schema<MessageDocument>(
  {
    _id: { type: String, required: true },
    conversationId: { type: String, required: true, index: true },
    externalId: { type: String, sparse: true },
    role: {
      type: String,
      enum: ['user', 'assistant', 'system', 'agent'] satisfies MessageRole[],
      required: true,
    },
    content: { type: String, required: true },
    status: {
      type: String,
      enum: ['received', 'processing', 'sent', 'failed', 'read'] satisfies MessageStatus[],
      default: 'received',
    },
    timestamp: { type: Date, required: true, default: Date.now },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    versionKey: false,
    collection: 'messages',
  },
);

messageSchema.index({ conversationId: 1, timestamp: 1 });

export const MessageModel = model<MessageDocument>('Message', messageSchema);
