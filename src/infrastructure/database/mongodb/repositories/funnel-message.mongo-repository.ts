import { randomUUID } from 'node:crypto';
import { FunnelMessageModel } from '../models/funnel-message.model.js';

/**
 * Persists conversation messages in the funnel_messages collection so the
 * admin panel can display the full chat history per lead.
 */
export class FunnelMessageMongoRepository {
  async saveUserMessage(params: {
    funnelUserId: string;
    text: string;
    isAnswered?: boolean;
  }): Promise<void> {
    await FunnelMessageModel.create({
      id: randomUUID(),
      userId: params.funnelUserId,
      text: params.text,
      role: 'user',
      direction: 'inbound',
      platform: 'whatsapp',
      timestamp: new Date(),
      isAnswered: params.isAnswered ?? false,
    });
  }

  async saveBotMessage(params: {
    funnelUserId: string;
    text: string;
  }): Promise<void> {
    await FunnelMessageModel.create({
      id: randomUUID(),
      userId: params.funnelUserId,
      text: params.text,
      role: 'bot',
      direction: 'outbound',
      platform: 'whatsapp',
      timestamp: new Date(),
      isAnswered: true,
    });
  }

  async saveAgentMessage(params: {
    funnelUserId: string;
    text: string;
    agentId: string;
  }): Promise<void> {
    await FunnelMessageModel.create({
      id: randomUUID(),
      userId: params.funnelUserId,
      text: params.text,
      role: 'agent',
      direction: 'outbound',
      platform: 'whatsapp',
      timestamp: new Date(),
      isAnswered: true,
      agentId: params.agentId,
    });
  }

  /** Mark the last unanswered inbound message of a user as answered. */
  async markLastUserMessageAnswered(funnelUserId: string): Promise<void> {
    await FunnelMessageModel.findOneAndUpdate(
      { userId: funnelUserId, direction: 'inbound', isAnswered: false },
      { $set: { isAnswered: true } },
      { sort: { timestamp: -1 } },
    );
  }
}
