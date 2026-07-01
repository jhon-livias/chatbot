import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { FunnelEtapa } from '../../../../domain/enums/funnel-etapa.enum.js';

// ── Raw document interface ─────────────────────────────────────────────────
export interface IPromptDocument {
  /** Etapa del funnel de conversión */
  funnel: FunnelEtapa;
  /** Referencia a la colección `intenciones` */
  intencionId: Types.ObjectId;
  /**
   * Plantilla Handlebars del prompt del sistema.
   *
   * Sintaxis soportada:
   *   - Variables:        {{variable}}
   *   - HTML sin escapar: {{{variable}}}
   *   - Condicionales:    {{#if condicion}}...{{/if}}
   *   - Iteración:        {{#each lista}}...{{/each}}
   *   - Parciales:        {{> nombre_parcial}}
   *   - Helpers:          {{helper argumento}}
   */
  contenido: string;
  /** Descripción interna del propósito del prompt */
  descripcion?: string;
  /** Lista de variables Handlebars que se esperan en el contexto de renderizado */
  variables: string[];
  version: number;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type PromptDocument = HydratedDocument<IPromptDocument>;

// ── Schema ─────────────────────────────────────────────────────────────────
const promptSchema = new Schema<IPromptDocument>(
  {
    funnel: {
      type: String,
      enum: Object.values(FunnelEtapa),
      required: [true, 'La etapa del funnel es requerida'],
      index: true,
    },
    intencionId: {
      type: Schema.Types.ObjectId,
      ref: 'Intencion',
      required: [true, 'La intención asociada es requerida'],
      index: true,
    },
    contenido: {
      type: String,
      required: [true, 'El contenido del prompt es requerido'],
      trim: true,
    },
    descripcion: {
      type: String,
      trim: true,
    },
    variables: {
      type: [String],
      default: [],
    },
    version: {
      type: Number,
      required: true,
      default: 1,
      min: [1, 'La versión debe ser mayor o igual a 1'],
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
    collection: 'prompts',
  },
);

// Garantiza que solo haya un prompt activo por funnel + intención
promptSchema.index(
  { funnel: 1, intencionId: 1, activo: 1 },
  {
    name: 'unique_active_prompt',
    partialFilterExpression: { activo: true },
  },
);

// Índice para historial de versiones
promptSchema.index({ intencionId: 1, version: -1 });

export const PromptModel = model<IPromptDocument>('Prompt', promptSchema);
