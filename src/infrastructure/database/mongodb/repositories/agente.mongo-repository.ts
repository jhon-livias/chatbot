import type { AgenteRepository } from '../../../../domain/repositories/agente.repository.js';
import { Agente } from '../../../../domain/entities/agente.entity.js';
import { AgenteModel, type IAgenteDocument } from '../models/agente.model.js';
import type { FlattenMaps } from 'mongoose';

type LeanAgente = FlattenMaps<IAgenteDocument>;

export class AgenteMongoRepository implements AgenteRepository {
  async findById(id: string): Promise<Agente | null> {
    const doc = await AgenteModel.findOne({ id }).lean();
    return doc ? this.toDomain(doc as LeanAgente) : null;
  }

  async findAll(): Promise<Agente[]> {
    const docs = await AgenteModel.find().lean();
    return (docs as LeanAgente[]).map((d) => this.toDomain(d));
  }

  async findActivos(): Promise<Agente[]> {
    const docs = await AgenteModel.find({ status: 'Active' }).lean();
    return (docs as LeanAgente[]).map((d) => this.toDomain(d));
  }

  async findByUserId(userId: string): Promise<Agente[]> {
    const docs = await AgenteModel.find({ userId }).lean();
    return (docs as LeanAgente[]).map((d) => this.toDomain(d));
  }

  async save(agente: Agente): Promise<Agente> {
    const props = agente.toProps();
    await AgenteModel.findOneAndUpdate(
      { id: props.id },
      {
        id: props.id,
        name: props.name,
        email: props.email,
        whatsapp: props.whatsapp,
        status: props.status,
        userId: props.userId,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      },
      { upsert: true, new: true },
    );
    return agente;
  }

  async delete(id: string): Promise<void> {
    await AgenteModel.deleteOne({ id });
  }

  private toDomain(doc: LeanAgente): Agente {
    return Agente.create({
      id: doc.id,
      name: doc.name,
      email: doc.email,
      whatsapp: doc.whatsapp,
      status: doc.status,
      userId: doc.userId,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  }
}
