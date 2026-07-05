import type { MessageRepository } from '../../../../domain/repositories/message.repository.js';
import { Message } from '../../../../domain/entities/message.entity.js';
import { MessageId } from '../../../../domain/value-objects/message-id.vo.js';
import { MessageModel } from '../models/message.model.js';

export class MessageMongoRepository implements MessageRepository {
  async findById(id: MessageId): Promise<Message | null> {
    const doc = await MessageModel.findById(id.value).lean();
    return doc ? this.toDomain(doc) : null;
  }

  async findByExternalId(externalId: string): Promise<Message | null> {
    const doc = await MessageModel.findOne({ externalId }).lean();
    return doc ? this.toDomain(doc) : null;
  }

  async findByConversationId(conversationId: string): Promise<Message[]> {
    const docs = await MessageModel.find({ conversationId }).sort({ timestamp: 1 }).lean();
    return docs.map((d) => this.toDomain(d));
  }

  async save(message: Message): Promise<Message> {
    const props = message.toProps();
    await MessageModel.findByIdAndUpdate(
      props.id.value,
      {
        _id: props.id.value,
        conversationId: props.conversationId,
        externalId: props.externalId,
        role: props.role,
        content: props.content,
        status: props.status,
        timestamp: props.timestamp,
        deliveredAt: props.deliveredAt,
        readAt: props.readAt,
        metadata: props.metadata,
      },
      { upsert: true, new: true },
    );
    return message;
  }

  async saveBatch(messages: Message[]): Promise<Message[]> {
    if (messages.length === 0) return [];
    await MessageModel.bulkWrite(
      messages.map((message) => {
        const props = message.toProps();
        const $set: Record<string, unknown> = {
          conversationId: props.conversationId,
          role: props.role,
          content: props.content,
          status: props.status,
          timestamp: props.timestamp,
        };
        if (props.externalId !== undefined) $set['externalId'] = props.externalId;
        if (props.deliveredAt !== undefined) $set['deliveredAt'] = props.deliveredAt;
        if (props.readAt !== undefined) $set['readAt'] = props.readAt;
        if (props.metadata !== undefined) $set['metadata'] = props.metadata;

        return {
          updateOne: {
            filter: { _id: props.id.value },
            update: { $set, $setOnInsert: { _id: props.id.value } },
            upsert: true,
          },
        };
      }),
    );
    return messages;
  }

  private toDomain(doc: {
    _id: unknown;
    conversationId: string;
    externalId?: string;
    role: Message['role'];
    content: string;
    status: Message['status'];
    timestamp: Date;
    deliveredAt?: Date;
    readAt?: Date;
    metadata?: Record<string, unknown>;
  }): Message {
    return Message.create({
      id: MessageId.from(String(doc._id)),
      conversationId: doc.conversationId,
      ...(doc.externalId !== undefined && { externalId: doc.externalId }),
      role: doc.role,
      content: doc.content,
      status: doc.status,
      timestamp: doc.timestamp,
      ...(doc.deliveredAt !== undefined && { deliveredAt: doc.deliveredAt }),
      ...(doc.readAt !== undefined && { readAt: doc.readAt }),
      ...(doc.metadata !== undefined && { metadata: doc.metadata }),
    });
  }
}
