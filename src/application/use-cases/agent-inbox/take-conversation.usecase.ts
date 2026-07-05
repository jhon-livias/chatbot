import type { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import type { FunnelUserMongoRepository } from '../../../infrastructure/database/mongodb/repositories/funnel-user.mongo-repository.js';

export interface TakeConversationInput {
  conversationId: string;
  agentId: string;
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
