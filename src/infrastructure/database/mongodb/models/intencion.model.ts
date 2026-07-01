import { Schema, model, type HydratedDocument } from 'mongoose';
import { IntencionCodigo } from '../../../../domain/enums/intencion-codigo.enum.js';

// ── Raw document interface ─────────────────────────────────────────────────
export interface IIntencionDocument {
  /** Slug único y estable — ver IntencionCodigo */
  codigo: IntencionCodigo;
  titulo: string;
  descripcion: string;
}

export type IntencionDocument = HydratedDocument<IIntencionDocument>;

// ── Schema ─────────────────────────────────────────────────────────────────
const intencionSchema = new Schema<IIntencionDocument>(
  {
    codigo: {
      type: String,
      enum: Object.values(IntencionCodigo),
      required: [true, 'El código de la intención es requerido'],
      unique: true,
      index: true,
    },
    titulo: {
      type: String,
      required: [true, 'El título de la intención es requerido'],
      trim: true,
    },
    descripcion: {
      type: String,
      required: [true, 'La descripción de la intención es requerida'],
      trim: true,
    },
  },
  {
    versionKey: false,
    collection: 'intenciones',
    // Las intenciones no necesitan timestamps — son registros estables
  },
);

export const IntencionModel = model<IIntencionDocument>('Intencion', intencionSchema);
