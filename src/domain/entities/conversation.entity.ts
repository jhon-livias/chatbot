import { Message } from './message.entity.js';

export type ConversationStatus = 'active' | 'idle' | 'closed';
export type HandoffState = 'none' | 'pending' | 'confirmed';

export interface ConversationMetaData {
  filterType: string | null;
  filterValue: string | string[];
}

export interface ConversationProps {
  id: string;
  userId: string;
  phoneNumber: string;
  status: ConversationStatus;
  messages: Message[];
  systemPrompt?: string;
  handoffState: HandoffState;
  consecutiveHandoffs: number;
  careerId: string | null;
  metaData: ConversationMetaData | null;
  currentProgramName: string | null;
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
  readonly handoffState: HandoffState;
  readonly consecutiveHandoffs: number;
  readonly careerId: string | null;
  readonly metaData: ConversationMetaData | null;
  readonly currentProgramName: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: ConversationProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.phoneNumber = props.phoneNumber;
    this.status = props.status;
    this.messages = props.messages;
    this.systemPrompt = props.systemPrompt;
    this.handoffState = props.handoffState;
    this.consecutiveHandoffs = props.consecutiveHandoffs;
    this.careerId = props.careerId;
    this.metaData = props.metaData;
    this.currentProgramName = props.currentProgramName;
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

  withHandoffState(state: HandoffState): Conversation {
    return Conversation.create({
      ...this.toProps(),
      handoffState: state,
      updatedAt: new Date(),
    });
  }

  incrementHandoffs(): Conversation {
    return Conversation.create({
      ...this.toProps(),
      consecutiveHandoffs: this.consecutiveHandoffs + 1,
      updatedAt: new Date(),
    });
  }

  resetHandoffs(): Conversation {
    return Conversation.create({
      ...this.toProps(),
      consecutiveHandoffs: 0,
      handoffState: 'none',
      updatedAt: new Date(),
    });
  }

  withIntentContext(careerId: string | null, metaData: ConversationMetaData | null, programName: string | null): Conversation {
    return Conversation.create({
      ...this.toProps(),
      careerId,
      metaData,
      currentProgramName: programName,
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
      handoffState: this.handoffState,
      consecutiveHandoffs: this.consecutiveHandoffs,
      careerId: this.careerId,
      metaData: this.metaData,
      currentProgramName: this.currentProgramName,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
