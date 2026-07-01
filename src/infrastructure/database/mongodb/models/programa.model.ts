import { Schema, model, type HydratedDocument } from 'mongoose';
import { TipoPrograma } from '../../../../domain/enums/tipo-programa.enum.js';
import { Modalidad } from '../../../../domain/enums/modalidad.enum.js';

// ── Raw document interface (sin métodos Mongoose) ──────────────────────────
export interface IProgramaDocument {
  nombre: string;
  facultad: string;
  tipo: TipoPrograma;
  modalidades: Modalidad[];
  /** Duración en formato legible, ej. "8 semestres" */
  duracion: string;
  /** Título académico otorgado */
  titulo: string;
  /** Número WhatsApp del coordinador en formato E.164 */
  whatsapp: string;
  /** Resumen corto (~200 chars) para mostrar al usuario */
  resumen: string;
  /**
   * Descripción extendida usada por el LLM para contextualizar respuestas.
   * Debe incluir: pensum, perfil del egresado, campo laboral, convenios, etc.
   */
  detalle_para_ia: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ProgramaDocument = HydratedDocument<IProgramaDocument>;

// ── Schema ─────────────────────────────────────────────────────────────────
const programaSchema = new Schema<IProgramaDocument>(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre del programa es requerido'],
      trim: true,
      index: true,
    },
    facultad: {
      type: String,
      required: [true, 'La facultad es requerida'],
      trim: true,
      index: true,
    },
    tipo: {
      type: String,
      enum: Object.values(TipoPrograma),
      required: [true, 'El tipo de programa es requerido'],
      index: true,
    },
    modalidades: {
      type: [String],
      enum: Object.values(Modalidad),
      required: [true, 'Se requiere al menos una modalidad'],
      validate: {
        validator: (v: string[]) => v.length > 0,
        message: 'El programa debe tener al menos una modalidad',
      },
    },
    duracion: {
      type: String,
      required: [true, 'La duración es requerida'],
      trim: true,
    },
    titulo: {
      type: String,
      required: [true, 'El título académico es requerido'],
      trim: true,
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
    resumen: {
      type: String,
      required: [true, 'El resumen es requerido'],
      trim: true,
    },
    detalle_para_ia: {
      type: String,
      required: [true, 'El campo detalle_para_ia es requerido'],
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'programas',
  },
);

// Índice de texto completo para búsqueda semántica básica
programaSchema.index(
  { nombre: 'text', resumen: 'text', detalle_para_ia: 'text' },
  { name: 'text_search', weights: { nombre: 10, resumen: 5, detalle_para_ia: 1 } },
);

export const ProgramaModel = model<IProgramaDocument>('Programa', programaSchema);
