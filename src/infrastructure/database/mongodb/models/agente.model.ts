import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export type AgentStatus = 'Active' | 'Inactive';

// ── Raw document interface (forma exacta del documento en MongoDB) ───────────
export interface IAgenteDocument {
  _id: Types.ObjectId;
  /** Identificador de negocio (UUID) */
  id: string;
  name: string;
  email: string;
  /** Número WhatsApp en formato E.164 para recibir notificaciones de handoff */
  whatsapp: string;
  status: AgentStatus;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type AgenteDocument = HydratedDocument<IAgenteDocument>;

// ── Schema ─────────────────────────────────────────────────────────────────
const agenteSchema = new Schema<IAgenteDocument>(
  {
    id: {
      type: String,
      required: [true, 'El id del agente es requerido'],
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'El nombre es requerido'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'El correo electrónico es requerido'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: 'El correo electrónico no tiene un formato válido',
      },
    },
    whatsapp: {
      type: String,
      required: [true, 'El número de WhatsApp es requerido'],
      trim: true,
      validate: {
        validator: (v: string) => /^\+[1-9]\d{7,14}$/.test(v),
        message: 'El número de WhatsApp debe estar en formato E.164',
      },
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      required: [true, 'El estado es requerido'],
      index: true,
    },
    userId: {
      type: String,
      required: [true, 'El userId es requerido'],
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'agents',
  },
);

export const AgenteModel = model<IAgenteDocument>('Agent', agenteSchema);
