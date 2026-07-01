import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

/**
 * Índice de embeddings vectoriales generados desde context_source_data.
 * Usado para búsqueda semántica (cosine similarity / kNN).
 */
export interface IVectorEmbeddingDocument {
  _id: Types.ObjectId;
  /** UUID del programa de origen (referencia a context_source_data.original_id) */
  original_id: string;
  /** Vector de embedding (dimensión variable según modelo) */
  embedding: number[];
  program_name: string;
  embedding_updated_at: Date;
}

export type VectorEmbeddingDocument = HydratedDocument<IVectorEmbeddingDocument>;

const vectorEmbeddingSchema = new Schema<IVectorEmbeddingDocument>(
  {
    original_id: { type: String, required: true, unique: true, index: true },
    embedding: { type: [Number], required: true },
    program_name: { type: String, required: true, trim: true, index: true },
    embedding_updated_at: { type: Date, required: true, default: Date.now },
  },
  {
    versionKey: false,
    collection: 'vector_embeddings_index',
  },
);

export const VectorEmbeddingModel = model<IVectorEmbeddingDocument>(
  'VectorEmbedding',
  vectorEmbeddingSchema,
);
