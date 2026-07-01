import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type { PromptVariableEntry } from '../../../../domain/entities/prompt.entity.js';

export type { PromptVariableEntry };

// ── Raw document interface (forma exacta del documento en MongoDB) ─────────
export interface IPromptDocument {
  _id: Types.ObjectId;
  /** Identificador de negocio (UUID) */
  id: string;
  title: string;
  active: boolean;
  funnelId: string;
  intentionId: string;
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
  template: string;
  /** Definición de variables dinámicas resueltas desde otras colecciones */
  variables: PromptVariableEntry[];
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type PromptDocument = HydratedDocument<IPromptDocument>;

// ── Sub-schema ─────────────────────────────────────────────────────────────
const promptVariableEntrySchema = new Schema<PromptVariableEntry>(
  {
    source: { type: String, required: true, trim: true },
    path: { type: String, required: true, trim: true },
    collectionId: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
  },
  { _id: false },
);

// ── Schema ─────────────────────────────────────────────────────────────────
const promptSchema = new Schema<IPromptDocument>(
  {
    id: {
      type: String,
      required: [true, 'El id del prompt es requerido'],
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'El título es requerido'],
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    funnelId: {
      type: String,
      required: [true, 'El funnelId es requerido'],
      index: true,
    },
    intentionId: {
      type: String,
      required: [true, 'El intentionId es requerido'],
      index: true,
    },
    template: {
      type: String,
      required: [true, 'El template del prompt es requerido'],
      trim: true,
    },
    variables: {
      type: [promptVariableEntrySchema],
      default: [],
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
    collection: 'prompts',
  },
);

promptSchema.index(
  { funnelId: 1, intentionId: 1, active: 1 },
  {
    name: 'unique_active_prompt',
    partialFilterExpression: { active: true },
  },
);

export const PromptModel = model<IPromptDocument>('Prompt', promptSchema);
