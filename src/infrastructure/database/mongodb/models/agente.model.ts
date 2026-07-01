import { Schema, model, type HydratedDocument } from 'mongoose';

// ── Raw document interface ─────────────────────────────────────────────────
export interface IAgenteDocument {
  nombre_completo: string;
  ubicacion: string;
  descripcion: string;
  email: string;
  /** Número WhatsApp en formato E.164 para recibir notificaciones de handoff */
  whatsapp: string;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type AgenteDocument = HydratedDocument<IAgenteDocument>;

// ── Schema ─────────────────────────────────────────────────────────────────
const agenteSchema = new Schema<IAgenteDocument>(
  {
    nombre_completo: {
      type: String,
      required: [true, 'El nombre completo es requerido'],
      trim: true,
    },
    ubicacion: {
      type: String,
      required: [true, 'La ubicación es requerida'],
      trim: true,
      index: true,
    },
    descripcion: {
      type: String,
      required: [true, 'La descripción es requerida'],
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
    activo: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'agentes',
  },
);

export const AgenteModel = model<IAgenteDocument>('Agente', agenteSchema);
