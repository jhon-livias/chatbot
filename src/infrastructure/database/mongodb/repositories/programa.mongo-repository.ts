import type { ProgramaRepository } from '../../../../domain/repositories/programa.repository.js';
import { Programa, type ProgramaProps } from '../../../../domain/entities/programa.entity.js';
import type { TipoPrograma } from '../../../../domain/enums/tipo-programa.enum.js';
import type { Modalidad } from '../../../../domain/enums/modalidad.enum.js';
import { ProgramaModel, type IProgramaDocument } from '../models/programa.model.js';
import type { FlattenMaps } from 'mongoose';

type LeanPrograma = FlattenMaps<IProgramaDocument> & { _id: unknown };

export class ProgramaMongoRepository implements ProgramaRepository {
  async findById(id: string): Promise<Programa | null> {
    const doc = await ProgramaModel.findById(id).lean();
    return doc ? this.toDomain(doc as LeanPrograma) : null;
  }

  async findAll(): Promise<Programa[]> {
    const docs = await ProgramaModel.find().lean();
    return (docs as LeanPrograma[]).map((d) => this.toDomain(d));
  }

  async findByTipo(tipo: TipoPrograma): Promise<Programa[]> {
    const docs = await ProgramaModel.find({ tipo }).lean();
    return (docs as LeanPrograma[]).map((d) => this.toDomain(d));
  }

  async findByModalidad(modalidad: Modalidad): Promise<Programa[]> {
    const docs = await ProgramaModel.find({ modalidades: modalidad }).lean();
    return (docs as LeanPrograma[]).map((d) => this.toDomain(d));
  }

  async findByFacultad(facultad: string): Promise<Programa[]> {
    const docs = await ProgramaModel.find({
      facultad: { $regex: facultad, $options: 'i' },
    }).lean();
    return (docs as LeanPrograma[]).map((d) => this.toDomain(d));
  }

  async search(query: string): Promise<Programa[]> {
    const docs = await ProgramaModel.find(
      { $text: { $search: query } },
      { score: { $meta: 'textScore' } },
    )
      .sort({ score: { $meta: 'textScore' } })
      .lean();
    return (docs as LeanPrograma[]).map((d) => this.toDomain(d));
  }

  async save(programa: Programa): Promise<Programa> {
    const props = programa.toProps();
    await ProgramaModel.findByIdAndUpdate(
      props.id,
      {
        _id: props.id,
        nombre: props.nombre,
        facultad: props.facultad,
        tipo: props.tipo,
        modalidades: props.modalidades,
        duracion: props.duracion,
        titulo: props.titulo,
        whatsapp: props.whatsapp,
        resumen: props.resumen,
        detalle_para_ia: props.detalle_para_ia,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      },
      { upsert: true, new: true },
    );
    return programa;
  }

  async delete(id: string): Promise<void> {
    await ProgramaModel.findByIdAndDelete(id);
  }

  private toDomain(doc: LeanPrograma): Programa {
    return Programa.create({
      id: String(doc._id),
      nombre: doc.nombre,
      facultad: doc.facultad,
      tipo: doc.tipo,
      modalidades: doc.modalidades as [Modalidad, ...Modalidad[]],
      duracion: doc.duracion,
      titulo: doc.titulo,
      whatsapp: doc.whatsapp,
      resumen: doc.resumen,
      detalle_para_ia: doc.detalle_para_ia,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    } satisfies ProgramaProps);
  }
}
