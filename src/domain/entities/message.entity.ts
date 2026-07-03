import { MessageId } from '../value-objects/message-id.vo.js';

export type MessageRole = 'user' | 'assistant' | 'system' | 'agent';
export type MessageStatus = 'received' | 'processing' | 'sent' | 'failed' | 'read';

export interface MessageProps {
  id: MessageId;
  conversationId: string;
  externalId?: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Domain entity representing a message within a conversation.
 */
export class Message {
  readonly id: MessageId;
  readonly conversationId: string;
  readonly externalId: string | undefined;
  readonly role: MessageRole;
  readonly content: string;
  readonly status: MessageStatus;
  readonly timestamp: Date;
  readonly metadata: Record<string, unknown> | undefined;

  private constructor(props: MessageProps) {
    this.id = props.id;
    this.conversationId = props.conversationId;
    this.externalId = props.externalId;
    this.role = props.role;
    this.content = props.content;
    this.status = props.status;
    this.timestamp = props.timestamp;
    this.metadata = props.metadata;
  }

  static create(props: MessageProps): Message {
    if (!props.content.trim()) {
      throw new Error('Message content cannot be empty');
    }
    return new Message(props);
  }

  markAs(status: MessageStatus): Message {
    return Message.create({ ...this.toProps(), status });
  }

  isFromUser(): boolean {
    return this.role === 'user';
  }

  isFromAssistant(): boolean {
    return this.role === 'assistant';
  }

  isFromAgent(): boolean {
    return this.role === 'agent';
  }

  toProps(): MessageProps {
    return {
      id: this.id,
      conversationId: this.conversationId,
      ...(this.externalId !== undefined && { externalId: this.externalId }),
      role: this.role,
      content: this.content,
      status: this.status,
      timestamp: this.timestamp,
      ...(this.metadata !== undefined && { metadata: this.metadata }),
    };
  }
}
