import { Schema, model, type Document } from 'mongoose';

export interface MessageDocument extends Document<string> {
  conversationId: string;
  externalId?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  status: 'received' | 'processing' | 'sent' | 'failed' | 'read';
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
      enum: ['user', 'assistant', 'system'],
      required: true,
    },
    content: { type: String, required: true },
    status: {
      type: String,
      enum: ['received', 'processing', 'sent', 'failed', 'read'],
      default: 'received',
    },
    timestamp: { type: Date, required: true, default: Date.now },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    versionKey: false,
  },
);

messageSchema.index({ conversationId: 1, timestamp: 1 });

export const MessageModel = model<MessageDocument>('Message', messageSchema);
