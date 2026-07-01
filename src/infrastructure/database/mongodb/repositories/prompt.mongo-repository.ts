import type { PromptRepository } from '../../../../domain/repositories/prompt.repository.js';
import { Prompt } from '../../../../domain/entities/prompt.entity.js';
import type { FunnelEtapa } from '../../../../domain/enums/funnel-etapa.enum.js';
import { PromptModel, type IPromptDocument } from '../models/prompt.model.js';
import type { FlattenMaps, Types } from 'mongoose';

type LeanPrompt = FlattenMaps<IPromptDocument> & { _id: unknown };

export class PromptMongoRepository implements PromptRepository {
  async findById(id: string): Promise<Prompt | null> {
    const doc = await PromptModel.findById(id).lean();
    return doc ? this.toDomain(doc as LeanPrompt) : null;
  }

  async findActivoByFunnelAndIntencion(
    funnel: FunnelEtapa,
    intencionId: string,
  ): Promise<Prompt | null> {
    const doc = await PromptModel.findOne({
      funnel,
      intencionId,
      activo: true,
    }).lean();
    return doc ? this.toDomain(doc as LeanPrompt) : null;
  }

  async findByIntencion(intencionId: string): Promise<Prompt[]> {
    const docs = await PromptModel.find({ intencionId }).sort({ version: -1 }).lean();
    return (docs as LeanPrompt[]).map((d) => this.toDomain(d));
  }

  async findByFunnel(funnel: FunnelEtapa): Promise<Prompt[]> {
    const docs = await PromptModel.find({ funnel }).lean();
    return (docs as LeanPrompt[]).map((d) => this.toDomain(d));
  }

  async save(prompt: Prompt): Promise<Prompt> {
    const props = prompt.toProps();
    const updateData: Record<string, unknown> = {
      _id: props.id,
      funnel: props.funnel,
      intencionId: props.intencionId,
      contenido: props.contenido,
      variables: props.variables,
      version: props.version,
      activo: props.activo,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    };
    if (props.descripcion !== undefined) updateData['descripcion'] = props.descripcion;

    await PromptModel.findByIdAndUpdate(props.id, updateData, { upsert: true, new: true });
    return prompt;
  }

  async delete(id: string): Promise<void> {
    await PromptModel.findByIdAndDelete(id);
  }

  private toDomain(doc: LeanPrompt): Prompt {
    const intencionId = String((doc.intencionId as Types.ObjectId).toString());
    const descripcion = (doc as LeanPrompt & { descripcion?: string }).descripcion;

    return Prompt.create({
      id: String(doc._id),
      funnel: doc.funnel,
      intencionId,
      contenido: doc.contenido,
      ...(descripcion !== undefined && { descripcion }),
      variables: doc.variables,
      version: doc.version,
      activo: doc.activo,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  }
}
