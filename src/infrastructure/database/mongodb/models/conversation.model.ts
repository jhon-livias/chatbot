import { Schema, model, type Document } from 'mongoose';

export type ConversationStatus = 'active' | 'idle' | 'closed';
export type HandoffState = 'none' | 'pending' | 'confirmed';

export interface ConversationDocument extends Document<string> {
  userId: string;
  phoneNumber: string;
  status: ConversationStatus;
  systemPrompt?: string;
  handoffState: HandoffState;
  consecutiveHandoffs: number;
  careerId: string | null;
  metaData: { filterType: string | null; filterValue: string | string[] } | null;
  currentProgramName: string | null;
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
    handoffState: {
      type: String,
      enum: ['none', 'pending', 'confirmed'] satisfies HandoffState[],
      default: 'none',
    },
    consecutiveHandoffs: { type: Number, default: 0 },
    careerId: { type: String, default: null },
    metaData: {
      type: {
        filterType: { type: String, default: null },
        filterValue: { type: Schema.Types.Mixed, default: null },
      },
      default: null,
    },
    currentProgramName: { type: String, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'conversations',
  },
);

conversationSchema.index({ phoneNumber: 1, status: 1 });

export const ConversationModel = model<ConversationDocument>('Conversation', conversationSchema);
