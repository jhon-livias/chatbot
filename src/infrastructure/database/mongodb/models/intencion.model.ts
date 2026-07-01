import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

// ── Raw document interface (forma exacta del documento en MongoDB) ───────────
export interface IIntencionDocument {
  _id: Types.ObjectId;
  /** Identificador de negocio (UUID) */
  id: string;
  userId: string;
  title: string;
  /** Tipo estable de la intención del funnel, ej. IDENTIFY_NEED */
  type: string;
  description: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type IntencionDocument = HydratedDocument<IIntencionDocument>;

// ── Schema ─────────────────────────────────────────────────────────────────
const intencionSchema = new Schema<IIntencionDocument>(
  {
    id: {
      type: String,
      required: [true, 'El id de la intención es requerido'],
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: [true, 'El userId es requerido'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'El título es requerido'],
      trim: true,
    },
    type: {
      type: String,
      required: [true, 'El type es requerido'],
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'La descripción es requerida'],
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'funnel_intentions',
  },
);

intencionSchema.index({ type: 1, active: 1 });

export const IntencionModel = model<IIntencionDocument>('FunnelIntention', intencionSchema);
