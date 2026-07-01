import { Schema, model, type Document } from 'mongoose';

export type ConversationStatus = 'active' | 'idle' | 'closed';

export interface ConversationDocument extends Document<string> {
  userId: string;
  phoneNumber: string;
  status: ConversationStatus;
  systemPrompt?: string;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<ConversationDocument>(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    phoneNumber: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['active', 'idle', 'closed'] satisfies ConversationStatus[],
      default: 'active',
      index: true,
    },
    systemPrompt: { type: String },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'conversations',
  },
);

conversationSchema.index({ phoneNumber: 1, status: 1 });

export const ConversationModel = model<ConversationDocument>('Conversation', conversationSchema);
