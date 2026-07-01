import { Schema, model, type Document } from 'mongoose';

export interface ConversationDocument extends Document {
  userId: string;
  phoneNumber: string;
  status: 'active' | 'idle' | 'closed';
  systemPrompt?: string;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<ConversationDocument>(
  {
    userId: { type: String, required: true, index: true },
    phoneNumber: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['active', 'idle', 'closed'],
      default: 'active',
      index: true,
    },
    systemPrompt: { type: String },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

conversationSchema.index({ phoneNumber: 1, status: 1 });

export const ConversationModel = model<ConversationDocument>('Conversation', conversationSchema);
