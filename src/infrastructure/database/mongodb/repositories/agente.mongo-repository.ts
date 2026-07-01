import type { AgenteRepository } from '../../../../domain/repositories/agente.repository.js';
import { Agente } from '../../../../domain/entities/agente.entity.js';
import { AgenteModel, type IAgenteDocument } from '../models/agente.model.js';
import type { FlattenMaps } from 'mongoose';

type LeanAgente = FlattenMaps<IAgenteDocument> & { _id: unknown };

export class AgenteMongoRepository implements AgenteRepository {
  async findById(id: string): Promise<Agente | null> {
    const doc = await AgenteModel.findById(id).lean();
    return doc ? this.toDomain(doc as LeanAgente) : null;
  }

  async findAll(): Promise<Agente[]> {
    const docs = await AgenteModel.find().lean();
    return (docs as LeanAgente[]).map((d) => this.toDomain(d));
  }

  async findActivos(): Promise<Agente[]> {
    const docs = await AgenteModel.find({ activo: true }).lean();
    return (docs as LeanAgente[]).map((d) => this.toDomain(d));
  }

  async findByUbicacion(ubicacion: string): Promise<Agente[]> {
    const docs = await AgenteModel.find({
      ubicacion: { $regex: ubicacion, $options: 'i' },
      activo: true,
    }).lean();
    return (docs as LeanAgente[]).map((d) => this.toDomain(d));
  }

  async save(agente: Agente): Promise<Agente> {
    const props = agente.toProps();
    await AgenteModel.findByIdAndUpdate(
      props.id,
      {
        _id: props.id,
        nombre_completo: props.nombre_completo,
        ubicacion: props.ubicacion,
        descripcion: props.descripcion,
        email: props.email,
        whatsapp: props.whatsapp,
        activo: props.activo,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      },
      { upsert: true, new: true },
    );
    return agente;
  }

  async delete(id: string): Promise<void> {
    await AgenteModel.findByIdAndDelete(id);
  }

  private toDomain(doc: LeanAgente): Agente {
    return Agente.create({
      id: String(doc._id),
      nombre_completo: doc.nombre_completo,
      ubicacion: doc.ubicacion,
      descripcion: doc.descripcion,
      email: doc.email,
      whatsapp: doc.whatsapp,
      activo: doc.activo,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  }
}
