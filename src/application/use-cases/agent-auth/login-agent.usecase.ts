import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { AgentRepository } from '../../../domain/repositories/agent.repository.js';

export interface LoginAgentInput {
  username: string;
  password: string;
}

export interface LoginAgentOutput {
  token: string;
  agent: {
    id: string;
    name: string;
    username: string;
    email: string;
  };
}

export class LoginAgentUseCase {
  constructor(private readonly agentRepo: AgentRepository) {}

  async execute(input: LoginAgentInput): Promise<LoginAgentOutput> {
    const username = input.username.toLowerCase().trim();

    const agent = await this.agentRepo.findByUsername(username);
    if (!agent) {
      throw new UnauthorizedError('Credenciales inválidas');
    }

    if (agent.status !== 'Active') {
      throw new UnauthorizedError('Cuenta inactiva. Contacte al administrador');
    }

    const rawDoc = await this.getPasswordHash(agent.id);
    if (!rawDoc) {
      throw new UnauthorizedError('Credenciales inválidas');
    }

    const valid = await bcrypt.compare(input.password, rawDoc);
    if (!valid) {
      throw new UnauthorizedError('Credenciales inválidas');
    }

    await this.agentRepo.updateLastLogin(agent.id);

    const secret = process.env['JWT_SECRET'];
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }

    const expiresIn = process.env['JWT_EXPIRES_IN'] ?? '8h';

    const token = jwt.sign(
      {
        sub: agent.id,
        username: agent.username,
        name: agent.name,
      },
      secret,
      { expiresIn } as jwt.SignOptions,
    );

    return {
      token,
      agent: {
        id: agent.id,
        name: agent.name,
        username: agent.username ?? username,
        email: agent.email,
      },
    };
  }

  /**
   * Fetches passwordHash directly from the DB — not exposed on the domain entity
   * to avoid accidental serialization.
   */
  private async getPasswordHash(agentId: string): Promise<string | null> {
    const { AgentModel } = await import(
      '../../../infrastructure/database/mongodb/models/agent.model.js'
    );
    const doc = await AgentModel.findOne({ id: agentId }).select('passwordHash').lean();
    return (doc as { passwordHash?: string | null } | null)?.passwordHash ?? null;
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}
