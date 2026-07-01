import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { TipoPrograma } from '../../../../domain/enums/tipo-programa.enum.js';
import { Modalidad } from '../../../../domain/enums/modalidad.enum.js';
import type {
  ProgramaCostEntry,
  ProgramaFaqEntry,
  ProgramaModalityEntry,
  ProgramaStatus,
} from '../../../../domain/entities/programa.entity.js';

export type { ProgramaCostEntry, ProgramaFaqEntry, ProgramaModalityEntry, ProgramaStatus };

// ── Raw document interface (forma exacta del documento en MongoDB) ───────────
export interface IProgramaDocument {
  _id: Types.ObjectId;
  /** Identificador de negocio (UUID) */
  id: string;
  name: string;
  types: TipoPrograma[];
  facultyId: string;
  duration: string;
  modalities: ProgramaModalityEntry[];
  academicDegree: string;
  professionalTitle: string;
  brochureUrl: string;
  summary: string;
  sellingPoints: string[];
  tags: string[];
  questionsAnswered: string[];
  faq: ProgramaFaqEntry[];
  graduateProfile: string;
  jobOpportunities: string[];
  objective: string;
  coverImage: string;
  gallery: string[];
  promoVideoUrl: string;
  admissionRequirements: string[];
  /** Número WhatsApp del coordinador en formato E.164 */
  whatsappContact: string;
  applicationFormUrl: string;
  thesisFolderFee: number;
  slug: string;
  status: ProgramaStatus;
  directorId: string;
  teacherIds: string[];
  totalCredits: number;
  userId: string;
  searchText: string;
  scheduleDescription: string;
  bachelorFolderFee: number;
  costs: ProgramaCostEntry[];
  /** Contexto extendido usado por el LLM para responder consultas (RAG) */
  iaInformation: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ProgramaDocument = HydratedDocument<IProgramaDocument>;

// ── Sub-schemas ────────────────────────────────────────────────────────────
const programModalityEntrySchema = new Schema<ProgramaModalityEntry>(
  {
    careerType: { type: String, required: true, trim: true },
    modalities: {
      type: [String],
      enum: Object.values(Modalidad),
      required: true,
      validate: {
        validator: (v: string[]) => v.length > 0,
        message: 'Cada tipo de carrera debe tener al menos una modalidad',
      },
    },
  },
  { _id: false },
);

const programFaqEntrySchema = new Schema<ProgramaFaqEntry>(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const programCostEntrySchema = new Schema<ProgramaCostEntry>(
  {
    currency: { type: String, required: true, trim: true },
    thesisFolderFee: { type: Number, required: true },
    bachelorFolderFee: { type: Number, required: true },
  },
  { _id: false },
);

// ── Schema ─────────────────────────────────────────────────────────────────
const programaSchema = new Schema<IProgramaDocument>(
  {
    id: {
      type: String,
      required: [true, 'El id del programa es requerido'],
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'El nombre del programa es requerido'],
      trim: true,
      index: true,
    },
    types: {
      type: [String],
      enum: Object.values(TipoPrograma),
      required: [true, 'Se requiere al menos un tipo de programa'],
      validate: {
        validator: (v: string[]) => v.length > 0,
        message: 'El programa debe tener al menos un tipo',
      },
      index: true,
    },
    facultyId: {
      type: String,
      required: [true, 'El facultyId es requerido'],
      index: true,
    },
    duration: {
      type: String,
      required: [true, 'La duración es requerida'],
      trim: true,
    },
    modalities: {
      type: [programModalityEntrySchema],
      required: [true, 'Se requiere al menos una modalidad'],
      validate: {
        validator: (v: ProgramaModalityEntry[]) => v.length > 0,
        message: 'El programa debe tener al menos una modalidad',
      },
    },
    academicDegree: { type: String, required: true, trim: true },
    professionalTitle: { type: String, required: true, trim: true },
    brochureUrl: { type: String, trim: true, default: '' },
    summary: { type: String, required: true, trim: true },
    sellingPoints: { type: [String], default: [] },
    tags: { type: [String], default: [], index: true },
    questionsAnswered: { type: [String], default: [] },
    faq: { type: [programFaqEntrySchema], default: [] },
    graduateProfile: { type: String, required: true, trim: true },
    jobOpportunities: { type: [String], default: [] },
    objective: { type: String, required: true, trim: true },
    coverImage: { type: String, trim: true, default: '' },
    gallery: { type: [String], default: [] },
    promoVideoUrl: { type: String, trim: true, default: '' },
    admissionRequirements: { type: [String], default: [] },
    whatsappContact: {
      type: String,
      required: [true, 'El número de WhatsApp es requerido'],
      trim: true,
      validate: {
        validator: (v: string) => v === '' || /^\+[1-9]\d{7,14}$/.test(v),
        message: 'El número de WhatsApp debe estar en formato E.164',
      },
    },
    applicationFormUrl: { type: String, trim: true, default: '' },
    thesisFolderFee: { type: Number, default: 0 },
    slug: {
      type: String,
      required: [true, 'El slug es requerido'],
      unique: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      required: [true, 'El estado es requerido'],
      index: true,
    },
    directorId: { type: String, required: true, index: true },
    teacherIds: { type: [String], default: [] },
    totalCredits: { type: Number, default: 0 },
    userId: { type: String, required: true, index: true },
    searchText: { type: String, trim: true, default: '', index: true },
    scheduleDescription: { type: String, trim: true, default: '' },
    bachelorFolderFee: { type: Number, default: 0 },
    costs: { type: [programCostEntrySchema], default: [] },
    iaInformation: { type: String, required: true, trim: true },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'programs',
  },
);

programaSchema.index(
  { name: 'text', summary: 'text', iaInformation: 'text', searchText: 'text' },
  { name: 'text_search', weights: { name: 10, summary: 5, iaInformation: 3, searchText: 8 } },
);

programaSchema.index({ 'modalities.modalities': 1 });

export const ProgramaModel = model<IProgramaDocument>('Program', programaSchema);
