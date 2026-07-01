import { Message } from './message.entity.js';

export type ConversationStatus = 'active' | 'idle' | 'closed';

export interface ConversationProps {
  id: string;
  userId: string;
  phoneNumber: string;
  status: ConversationStatus;
  messages: Message[];
  systemPrompt?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Conversation {
  readonly id: string;
  readonly userId: string;
  readonly phoneNumber: string;
  readonly status: ConversationStatus;
  readonly messages: ReadonlyArray<Message>;
  readonly systemPrompt: string | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: ConversationProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.phoneNumber = props.phoneNumber;
    this.status = props.status;
    this.messages = props.messages;
    this.systemPrompt = props.systemPrompt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: ConversationProps): Conversation {
    return new Conversation(props);
  }

  addMessage(message: Message): Conversation {
    return Conversation.create({
      ...this.toProps(),
      messages: [...this.messages, message],
      updatedAt: new Date(),
    });
  }

  close(): Conversation {
    return Conversation.create({
      ...this.toProps(),
      status: 'closed',
      updatedAt: new Date(),
    });
  }

  getLastNMessages(n: number): ReadonlyArray<Message> {
    return this.messages.slice(-n);
  }

  toProps(): ConversationProps {
    return {
      id: this.id,
      userId: this.userId,
      phoneNumber: this.phoneNumber,
      status: this.status,
      messages: [...this.messages],
      ...(this.systemPrompt !== undefined && { systemPrompt: this.systemPrompt }),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
