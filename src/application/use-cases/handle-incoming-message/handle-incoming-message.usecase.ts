import { randomUUID } from 'node:crypto';
import type { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import type { UserRepository } from '../../../domain/repositories/user.repository.js';
import type { ProgramRepository } from '../../../domain/repositories/program.repository.js';
import type { AiProviderPort } from '../../ports/ai-provider.port.js';
import type { MessagingProviderPort } from '../../ports/messaging-provider.port.js';
import type { SystemPromptBuilderService } from '../../services/system-prompt-builder.service.js';
import { PhoneNumber } from '../../../domain/value-objects/phone-number.vo.js';
import { MessageId } from '../../../domain/value-objects/message-id.vo.js';
import { User } from '../../../domain/entities/user.entity.js';
import { Message } from '../../../domain/entities/message.entity.js';
import { Conversation } from '../../../domain/entities/conversation.entity.js';
import type {
  HandleIncomingMessageDto,
  HandleIncomingMessageResult,
} from './handle-incoming-message.dto.js';
import { formatWhatsAppText } from '../../../infrastructure/webhooks/meta/format-whatsapp-text.js';
import { logger } from '../../../infrastructure/shared/logger.js';

const CONTEXT_WINDOW_SIZE = 10;
const FALLBACK_SYSTEM_PROMPT =
  'Eres un asistente virtual de UPRIT. Responde de manera concisa, amable y en el mismo idioma que el usuario. Usa texto plano sin markdown (sin **, *, # ni bloques de codigo) porque el canal es WhatsApp.';

/**
 * Orchestrates inbound WhatsApp messages: persist, call AI, and reply.
 * On the first message of a conversation the system prompt is built from live DB data
 * (programs, FAQ, iaInformation) and stored on the conversation for subsequent messages.
 */
export class HandleIncomingMessageUseCase {
  constructor(
    private readonly conversationRepo: ConversationRepository,
    private readonly userRepo: UserRepository,
    private readonly aiProvider: AiProviderPort,
    private readonly messagingProvider: MessagingProviderPort,
    private readonly programRepo?: ProgramRepository,
    private readonly promptBuilder?: SystemPromptBuilderService,
  ) {}

  async execute(dto: HandleIncomingMessageDto): Promise<HandleIncomingMessageResult> {
    const phoneNumber = PhoneNumber.create(dto.fromPhoneNumber);

    let user = await this.userRepo.findByPhoneNumber(phoneNumber);
    if (!user) {
      user = User.create({
        id: randomUUID(),
        phoneNumber,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      user = await this.userRepo.save(user);
    }

    let conversation = await this.conversationRepo.findActiveByPhoneNumber(phoneNumber.value);
    if (!conversation) {
      const systemPrompt = await this.buildSystemPrompt();
      conversation = Conversation.create({
        id: randomUUID(),
        userId: user.id,
        phoneNumber: phoneNumber.value,
        status: 'active',
        messages: [],
        systemPrompt,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const userMessage = Message.create({
      id: MessageId.generate(),
      conversationId: conversation.id,
      externalId: dto.externalMessageId,
      role: 'user',
      content: dto.content,
      status: 'received',
      timestamp: new Date(dto.timestamp),
    });

    conversation = conversation.addMessage(userMessage);
    await this.conversationRepo.save(conversation);

    const recentMessages = conversation.getLastNMessages(CONTEXT_WINDOW_SIZE);
    const chatHistory = recentMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const activeSystemPrompt = conversation.systemPrompt ?? FALLBACK_SYSTEM_PROMPT;

    const aiResult = await this.aiProvider.complete([
      { role: 'system', content: activeSystemPrompt },
      ...chatHistory,
    ]);

    const assistantMessage = Message.create({
      id: MessageId.generate(),
      conversationId: conversation.id,
      role: 'assistant',
      content: aiResult.content,
      status: 'processing',
      timestamp: new Date(),
      metadata: {
        model: aiResult.model,
        tokens: aiResult.totalTokens,
      },
    });

    conversation = conversation.addMessage(assistantMessage);
    await this.conversationRepo.save(conversation);

    const replyText = formatWhatsAppText(aiResult.content);

    await this.messagingProvider.sendTextMessage({
      to: phoneNumber.value,
      body: replyText,
    });

    return {
      conversationId: conversation.id,
      userMessageId: userMessage.id.value,
      aiResponseId: assistantMessage.id.value,
      aiResponseContent: replyText,
    };
  }

  private async buildSystemPrompt(): Promise<string> {
    if (!this.programRepo || !this.promptBuilder) {
      return FALLBACK_SYSTEM_PROMPT;
    }
    try {
      const programs = await this.programRepo.findActive();
      const prompt = this.promptBuilder.build(programs);
      logger.info('[HandleIncomingMessage] System prompt built from DB', {
        programs: programs.length,
        promptLength: prompt.length,
      });
      return prompt;
    } catch (err) {
      logger.warn('[HandleIncomingMessage] Failed to load programs; using fallback prompt', {
        error: err instanceof Error ? err.message : String(err),
      });
      return FALLBACK_SYSTEM_PROMPT;
    }
  }
}
