import type { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import type { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import type { FunnelUserMongoRepository } from '../../../infrastructure/database/mongodb/repositories/funnel-user.mongo-repository.js';
import { isHandoffExcludedAgent } from '../../services/handoff-excluded-agents.js';

export interface TakeConversationInput {
  conversationId: string;
  agentId: string;
  agentUsername?: string | null;
}

export interface TakeConversationOutput {
  success: true;
  mode: 'human';
  assignedAgentId: string;
}

export class TakeConversationUseCase {
  constructor(
    private readonly conversationRepo: ConversationRepository,
    private readonly funnelUserRepo: FunnelUserMongoRepository,
  ) {}

  async execute(input: TakeConversationInput): Promise<TakeConversationOutput> {
    if (isHandoffExcludedAgent(input.agentUsername)) {
      throw new Error('Esta cuenta de prueba no puede tomar conversaciones');
    }

    const conversation = await this.conversationRepo.findById(input.conversationId);
    if (!conversation) {
      throw new Error('Conversación no encontrada');
    }

    if (!conversation.isBotMode()) {
      throw new Error('Este chat ya está en atención humana');
    }

    const updated = conversation.withHumanHandoff(input.agentId, 'agent');
    await this.conversationRepo.save(updated);

    const funnelUser = await this.funnelUserRepo.findBySenderId(conversation.phoneNumber);
    if (funnelUser) {
      await this.funnelUserRepo.updateById({
        id: funnelUser.id,
        stage: 'HANDOFF',
        assignedAgent: input.agentId,
      });
    }

    return {
      success: true,
      mode: 'human',
      assignedAgentId: input.agentId,
    };
  }
}
