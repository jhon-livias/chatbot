import type { IntencionRepository } from '../../../../domain/repositories/intencion.repository.js';
import { Intencion } from '../../../../domain/entities/intencion.entity.js';
import { IntencionModel, type IIntencionDocument } from '../models/intencion.model.js';
import type { FlattenMaps } from 'mongoose';

type LeanIntencion = FlattenMaps<IIntencionDocument>;

export class IntencionMongoRepository implements IntencionRepository {
  async findById(id: string): Promise<Intencion | null> {
    const doc = await IntencionModel.findOne({ id }).lean();
    return doc ? this.toDomain(doc as LeanIntencion) : null;
  }

  async findByType(type: string): Promise<Intencion | null> {
    const doc = await IntencionModel.findOne({ type, active: true }).lean();
    return doc ? this.toDomain(doc as LeanIntencion) : null;
  }

  async findAll(): Promise<Intencion[]> {
    const docs = await IntencionModel.find().lean();
    return (docs as LeanIntencion[]).map((d) => this.toDomain(d));
  }

  async findActivas(): Promise<Intencion[]> {
    const docs = await IntencionModel.find({ active: true }).lean();
    return (docs as LeanIntencion[]).map((d) => this.toDomain(d));
  }

  async save(intencion: Intencion): Promise<Intencion> {
    const props = intencion.toProps();
    await IntencionModel.findOneAndUpdate(
      { id: props.id },
      {
        id: props.id,
        userId: props.userId,
        title: props.title,
        type: props.type,
        description: props.description,
        active: props.active,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      },
      { upsert: true, new: true },
    );
    return intencion;
  }

  async saveBatch(intenciones: Intencion[]): Promise<Intencion[]> {
    const ops = intenciones.map((intencion) => {
      const props = intencion.toProps();
      return {
        updateOne: {
          filter: { type: props.type },
          update: {
            $setOnInsert: {
              id: props.id,
              userId: props.userId,
              title: props.title,
              type: props.type,
              description: props.description,
              active: props.active,
              createdAt: props.createdAt,
              updatedAt: props.updatedAt,
            },
          },
          upsert: true,
        },
      };
    });
    await IntencionModel.bulkWrite(ops);
    return intenciones;
  }

  async delete(id: string): Promise<void> {
    await IntencionModel.deleteOne({ id });
  }

  private toDomain(doc: LeanIntencion): Intencion {
    return Intencion.create({
      id: doc.id,
      userId: doc.userId,
      title: doc.title,
      type: doc.type,
      description: doc.description,
      active: doc.active,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  }
}
