import type { ConversationRepository } from '../../../../domain/repositories/conversation.repository.js';
import { Conversation } from '../../../../domain/entities/conversation.entity.js';
import { ConversationModel } from '../models/conversation.model.js';
import { MessageModel } from '../models/message.model.js';
import { Message } from '../../../../domain/entities/message.entity.js';
import { MessageId } from '../../../../domain/value-objects/message-id.vo.js';

export class ConversationMongoRepository implements ConversationRepository {
  async findById(id: string): Promise<Conversation | null> {
    const doc = await ConversationModel.findById(id).lean();
    if (!doc) return null;
    const messages = await this.loadMessages(id);
    return this.toDomain(doc, messages);
  }

  async findActiveByPhoneNumber(phoneNumber: string): Promise<Conversation | null> {
    const doc = await ConversationModel.findOne({ phoneNumber, status: 'active' }).lean();
    if (!doc) return null;
    const messages = await this.loadMessages(String(doc._id));
    return this.toDomain(doc, messages);
  }

  async findByUserId(userId: string): Promise<Conversation[]> {
    const docs = await ConversationModel.find({ userId }).lean();
    return Promise.all(
      docs.map(async (doc) => {
        const messages = await this.loadMessages(String(doc._id));
        return this.toDomain(doc, messages);
      }),
    );
  }

  async save(conversation: Conversation): Promise<Conversation> {
    const props = conversation.toProps();
    await ConversationModel.findByIdAndUpdate(
      props.id,
      {
        _id: props.id,
        userId: props.userId,
        phoneNumber: props.phoneNumber,
        status: props.status,
        systemPrompt: props.systemPrompt,
        updatedAt: props.updatedAt,
        createdAt: props.createdAt,
      },
      { upsert: true, new: true },
    );

    const messageDocs = props.messages.map((m) => ({
      _id: m.id.value,
      conversationId: m.conversationId,
      externalId: m.externalId,
      role: m.role,
      content: m.content,
      status: m.status,
      timestamp: m.timestamp,
      metadata: m.metadata,
    }));

    if (messageDocs.length > 0) {
      await MessageModel.bulkWrite(
        messageDocs.map((doc) => {
          const { externalId, metadata, ...required } = doc;
          const $set: Record<string, unknown> = { ...required };
          if (externalId !== undefined) $set['externalId'] = externalId;
          if (metadata !== undefined) $set['metadata'] = metadata;
          return {
            updateOne: {
              filter: { _id: doc._id },
              update: { $set },
              upsert: true,
            },
          };
        }),
      );
    }

    return conversation;
  }

  async delete(id: string): Promise<void> {
    await Promise.all([
      ConversationModel.findByIdAndDelete(id),
      MessageModel.deleteMany({ conversationId: id }),
    ]);
  }

  private async loadMessages(conversationId: string): Promise<Message[]> {
    const docs = await MessageModel.find({ conversationId }).sort({ timestamp: 1 }).lean();
    return docs.map((d) =>
      Message.create({
        id: MessageId.from(String(d._id)),
        conversationId: d.conversationId,
        ...(d.externalId !== undefined && { externalId: d.externalId }),
        role: d.role,
        content: d.content,
        status: d.status,
        timestamp: d.timestamp,
        ...(d.metadata !== undefined && { metadata: d.metadata as Record<string, unknown> }),
      }),
    );
  }

  private toDomain(
    doc: Record<string, unknown>,
    messages: Message[],
  ): Conversation {
    const systemPrompt = doc['systemPrompt'] as string | undefined;
    return Conversation.create({
      id: String(doc['_id']),
      userId: doc['userId'] as string,
      phoneNumber: doc['phoneNumber'] as string,
      status: doc['status'] as 'active' | 'idle' | 'closed',
      messages,
      ...(systemPrompt !== undefined && { systemPrompt }),
      createdAt: doc['createdAt'] as Date,
      updatedAt: doc['updatedAt'] as Date,
    });
  }
}
