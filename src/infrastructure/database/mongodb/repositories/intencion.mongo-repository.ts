import type { IntencionRepository } from '../../../../domain/repositories/intencion.repository.js';
import { Intencion } from '../../../../domain/entities/intencion.entity.js';
import type { IntencionCodigo } from '../../../../domain/enums/intencion-codigo.enum.js';
import { IntencionModel, type IIntencionDocument } from '../models/intencion.model.js';
import type { FlattenMaps } from 'mongoose';

type LeanIntencion = FlattenMaps<IIntencionDocument> & { _id: unknown };

export class IntencionMongoRepository implements IntencionRepository {
  async findById(id: string): Promise<Intencion | null> {
    const doc = await IntencionModel.findById(id).lean();
    return doc ? this.toDomain(doc as LeanIntencion) : null;
  }

  async findByCodigo(codigo: IntencionCodigo): Promise<Intencion | null> {
    const doc = await IntencionModel.findOne({ codigo }).lean();
    return doc ? this.toDomain(doc as LeanIntencion) : null;
  }

  async findAll(): Promise<Intencion[]> {
    const docs = await IntencionModel.find().lean();
    return (docs as LeanIntencion[]).map((d) => this.toDomain(d));
  }

  async save(intencion: Intencion): Promise<Intencion> {
    const props = intencion.toProps();
    await IntencionModel.findByIdAndUpdate(
      props.id,
      { _id: props.id, codigo: props.codigo, titulo: props.titulo, descripcion: props.descripcion },
      { upsert: true, new: true },
    );
    return intencion;
  }

  async saveBatch(intenciones: Intencion[]): Promise<Intencion[]> {
    const ops = intenciones.map((i) => {
      const p = i.toProps();
      return {
        updateOne: {
          filter: { codigo: p.codigo },
          update: { $setOnInsert: { _id: p.id, codigo: p.codigo, titulo: p.titulo, descripcion: p.descripcion } },
          upsert: true,
        },
      };
    });
    await IntencionModel.bulkWrite(ops);
    return intenciones;
  }

  private toDomain(doc: LeanIntencion): Intencion {
    return Intencion.create({
      id: String(doc._id),
      codigo: doc.codigo,
      titulo: doc.titulo,
      descripcion: doc.descripcion,
    });
  }
}
