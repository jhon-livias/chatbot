import type { AgentRepository } from '../../../../domain/repositories/agent.repository.js';
import { Agent } from '../../../../domain/entities/agent.entity.js';
import { AgentModel, type IAgentDocument } from '../models/agent.model.js';
import type { FlattenMaps } from 'mongoose';

type LeanAgent = FlattenMaps<IAgentDocument>;

export class AgentMongoRepository implements AgentRepository {
  async findById(id: string): Promise<Agent | null> {
    const doc = await AgentModel.findOne({ id }).lean();
    return doc ? this.toDomain(doc as LeanAgent) : null;
  }

  async findAll(): Promise<Agent[]> {
    const docs = await AgentModel.find().lean();
    return (docs as LeanAgent[]).map((d) => this.toDomain(d));
  }

  async findActive(): Promise<Agent[]> {
    const docs = await AgentModel.find({ status: 'Active' }).lean();
    return (docs as LeanAgent[]).map((d) => this.toDomain(d));
  }

  async findByUserId(userId: string): Promise<Agent[]> {
    const docs = await AgentModel.find({ userId }).lean();
    return (docs as LeanAgent[]).map((d) => this.toDomain(d));
  }

  async findByUsername(username: string): Promise<Agent | null> {
    const doc = await AgentModel.findOne({ username: username.toLowerCase() }).lean();
    return doc ? this.toDomain(doc as LeanAgent) : null;
  }

  async save(agent: Agent): Promise<Agent> {
    const props = agent.toProps();
    await AgentModel.findOneAndUpdate(
      { id: props.id },
      {
        id: props.id,
        name: props.name,
        email: props.email,
        whatsapp: props.whatsapp,
        status: props.status,
        userId: props.userId,
        username: props.username,
        lastLoginAt: props.lastLoginAt,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      },
      { upsert: true, new: true },
    );
    return agent;
  }

  async delete(id: string): Promise<void> {
    await AgentModel.deleteOne({ id });
  }

  async updatePasswordHash(agentId: string, hash: string): Promise<void> {
    await AgentModel.updateOne({ id: agentId }, { $set: { passwordHash: hash } });
  }

  async updateLastLogin(agentId: string): Promise<void> {
    await AgentModel.updateOne({ id: agentId }, { $set: { lastLoginAt: new Date() } });
  }

  private toDomain(doc: LeanAgent): Agent {
    return Agent.create({
      id: doc.id,
      name: doc.name,
      email: doc.email,
      whatsapp: doc.whatsapp,
      status: doc.status,
      userId: doc.userId,
      username: doc.username ?? null,
      lastLoginAt: doc.lastLoginAt ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  }
}
