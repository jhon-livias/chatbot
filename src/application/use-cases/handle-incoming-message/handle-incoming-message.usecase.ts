import { randomUUID } from 'node:crypto';
import type { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import type { UserRepository } from '../../../domain/repositories/user.repository.js';
import type { ProgramRepository } from '../../../domain/repositories/program.repository.js';
import type { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import type { AiProviderPort } from '../../ports/ai-provider.port.js';
import type { MessagingProviderPort } from '../../ports/messaging-provider.port.js';
import type { SystemPromptBuilderService } from '../../services/system-prompt-builder.service.js';
import type { IntentRouterService } from '../../services/intent-router.service.js';
import type { FunnelUserMongoRepository } from '../../../infrastructure/database/mongodb/repositories/funnel-user.mongo-repository.js';
import type { FunnelMessageMongoRepository } from '../../../infrastructure/database/mongodb/repositories/funnel-message.mongo-repository.js';
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
import type { Agent } from '../../../domain/entities/agent.entity.js';

const CONTEXT_WINDOW_SIZE = 10;
const MAX_CONSECUTIVE_HANDOFFS = 3;

const FALLBACK_SYSTEM_PROMPT =
  'Eres Angela, asesora estudiantil de UPRIT. Responde de manera concisa, amable y en el mismo idioma que el usuario. Usa texto plano sin markdown porque el canal es WhatsApp. Responde UNICAMENTE con el token HANDOFF_TRIGGER cuando el usuario pida hablar con un asesor o cuando no tengas informacion para responder.';

const HANDOFF_CONFIRMATION_MSG =
  '¿Deseas que te contacte un asesor de admisiones para brindarte información personalizada? (Sí/No)';

const HANDOFF_CONFIRMED_MSG =
  '¡Perfecto! Un asesor de admisiones se pondrá en contacto contigo muy pronto. 😊 Gracias por tu interés en la UPRIT.';

const HANDOFF_DECLINED_MSG =
  'Entendido, con gusto seguiré ayudándote. ¿En qué más puedo asistirte?';

const HANDOFF_LOOP_MSG =
  'Veo que no he podido darte la información que buscas. Un asesor de admisiones se pondrá en contacto contigo para ayudarte de forma personalizada.';

// Matches affirmative responses when user confirms wanting an advisor
const AFFIRMATIVE_PATTERN =
  /\b(s[íi]|si|yes|claro|ok|okay|dale|perfecto|de\s*acuerdo|est[aá]\s*bien|acepto|quiero|as[ií]gname|adelante|afirmativo|por\s*favor|bueno|correcto|exacto|listo)\b/i;

/**
 * Orchestrates inbound WhatsApp messages: persist, call AI, and reply.
 * Handles the full handoff flow (HANDOFF_TRIGGER detection, confirmation, agent notification,
 * and loop detection after 3 consecutive unanswered interactions).
 */
export class HandleIncomingMessageUseCase {
  constructor(
    private readonly conversationRepo: ConversationRepository,
    private readonly userRepo: UserRepository,
    private readonly aiProvider: AiProviderPort,
    private readonly messagingProvider: MessagingProviderPort,
    private readonly programRepo?: ProgramRepository,
    private readonly promptBuilder?: SystemPromptBuilderService,
    private readonly agentRepo?: AgentRepository,
    private readonly intentRouter?: IntentRouterService,
    private readonly funnelUserRepo?: FunnelUserMongoRepository,
    private readonly funnelMessageRepo?: FunnelMessageMongoRepository,
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
        handoffState: 'none',
        consecutiveHandoffs: 0,
        careerId: null,
        metaData: null,
        currentProgramName: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // --- Handoff pending: user is answering the yes/no confirmation ---
    if (conversation.handoffState === 'pending') {
      return this.handlePendingHandoffReply(conversation, dto, phoneNumber.value);
    }

    // --- Normal message processing ---
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

    // ── Upsert funnel_users so the admin panel can see this lead ──────────
    const funnelUserId = await this.upsertFunnelUser(phoneNumber.value);

    // Save the inbound message to funnel_messages
    await this.saveFunnelMessage(funnelUserId, dto.content, 'user');

    // ── AI response: try intent routing first, fall back to monolithic prompt ──
    let aiContent: string;
    let aiModel: string;
    let aiTokens: number;
    let newCareerId = conversation.careerId;
    let newMetaData = conversation.metaData;
    let newProgramName = conversation.currentProgramName;
    let purchaseCategory: string | null = null;

    if (this.intentRouter) {
      try {
        const routerResult = await this.intentRouter.route({
          messages: conversation.messages,
          userMessage: dto.content,
          careerId: conversation.careerId,
          metaData: conversation.metaData,
          programName: conversation.currentProgramName,
        });
        aiContent = routerResult.content;
        aiModel = routerResult.model;
        aiTokens = routerResult.totalTokens;
        newCareerId = routerResult.newCareerId ?? conversation.careerId;
        newMetaData = routerResult.newMetaData ?? conversation.metaData;
        newProgramName = routerResult.newProgramName ?? conversation.currentProgramName;
        purchaseCategory = routerResult.purchaseCategory;
      } catch (routerErr) {
        logger.warn('[HandleIncomingMessage] IntentRouter failed — falling back to monolithic prompt', {
          error: routerErr instanceof Error ? routerErr.message : String(routerErr),
        });
        const fallbackResult = await this.runMonolithicPrompt(conversation, dto.content);
        aiContent = fallbackResult.content;
        aiModel = fallbackResult.model;
        aiTokens = fallbackResult.totalTokens;
      }
    } else {
      const fallbackResult = await this.runMonolithicPrompt(conversation, dto.content);
      aiContent = fallbackResult.content;
      aiModel = fallbackResult.model;
      aiTokens = fallbackResult.totalTokens;
    }

    const isHandoff = this.detectHandoffTrigger(aiContent);

    if (isHandoff) {
      const newConsecutive = conversation.consecutiveHandoffs + 1;

      if (newConsecutive >= MAX_CONSECUTIVE_HANDOFFS) {
        // Loop detected: trigger handoff immediately without asking
        logger.warn('[HandleIncomingMessage] Loop detected — triggering automatic handoff', {
          phone: phoneNumber.value,
          consecutiveHandoffs: newConsecutive,
        });

        conversation = conversation
          .incrementHandoffs()
          .withHandoffState('confirmed')
          .close();
        await this.conversationRepo.save(conversation);

        await this.messagingProvider.sendTextMessage({
          to: phoneNumber.value,
          body: HANDOFF_LOOP_MSG,
        });

        await this.saveFunnelMessage(funnelUserId, HANDOFF_LOOP_MSG, 'bot');
        await this.updateFunnelUserStage(funnelUserId, 'HANDOFF', null);

        const agent = await this.tryNotifyAgent(conversation, phoneNumber.value);
        if (agent && funnelUserId) {
          await this.updateFunnelUserStage(funnelUserId, 'HANDOFF', agent.whatsapp);
        }

        return {
          conversationId: conversation.id,
          userMessageId: userMessage.id.value,
          aiResponseId: '',
          aiResponseContent: HANDOFF_LOOP_MSG,
        };
      }

      // Ask the user if they want to be contacted by an advisor
      conversation = conversation.incrementHandoffs().withHandoffState('pending');
      await this.conversationRepo.save(conversation);

      await this.messagingProvider.sendTextMessage({
        to: phoneNumber.value,
        body: HANDOFF_CONFIRMATION_MSG,
      });

      await this.saveFunnelMessage(funnelUserId, HANDOFF_CONFIRMATION_MSG, 'bot');
      await this.updateFunnelUserStage(funnelUserId, 'DECISION', null);

      logger.info('[HandleIncomingMessage] HANDOFF_TRIGGER detected — asking for confirmation', {
        phone: phoneNumber.value,
        consecutiveHandoffs: conversation.consecutiveHandoffs,
      });

      return {
        conversationId: conversation.id,
        userMessageId: userMessage.id.value,
        aiResponseId: '',
        aiResponseContent: HANDOFF_CONFIRMATION_MSG,
      };
    }

    // Normal response: save assistant message and reply
    const assistantMessage = Message.create({
      id: MessageId.generate(),
      conversationId: conversation.id,
      role: 'assistant',
      content: aiContent,
      status: 'processing',
      timestamp: new Date(),
      metadata: { model: aiModel, tokens: aiTokens },
    });

    conversation = conversation
      .addMessage(assistantMessage)
      .resetHandoffs()
      .withIntentContext(newCareerId, newMetaData, newProgramName);
    await this.conversationRepo.save(conversation);

    const replyText = formatWhatsAppText(aiContent);

    await this.messagingProvider.sendTextMessage({
      to: phoneNumber.value,
      body: replyText,
    });

    // Save bot reply to funnel_messages and update lead stage
    await this.saveFunnelMessage(funnelUserId, replyText, 'bot');
    if (purchaseCategory) {
      await this.updateFunnelUserCategory(funnelUserId, purchaseCategory);
    }

    return {
      conversationId: conversation.id,
      userMessageId: userMessage.id.value,
      aiResponseId: assistantMessage.id.value,
      aiResponseContent: replyText,
    };
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private async handlePendingHandoffReply(
    conversation: Conversation,
    dto: HandleIncomingMessageDto,
    phoneNumberValue: string,
  ): Promise<HandleIncomingMessageResult> {
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

    // Ensure funnel user exists for this phone
    const funnelUserId = await this.upsertFunnelUser(phoneNumberValue);
    await this.saveFunnelMessage(funnelUserId, dto.content, 'user');

    const isAffirmative = AFFIRMATIVE_PATTERN.test(dto.content.trim());

    if (isAffirmative) {
      conversation = conversation.withHandoffState('confirmed').close();
      await this.conversationRepo.save(conversation);

      await this.messagingProvider.sendTextMessage({
        to: phoneNumberValue,
        body: HANDOFF_CONFIRMED_MSG,
      });

      await this.saveFunnelMessage(funnelUserId, HANDOFF_CONFIRMED_MSG, 'bot');

      const agent = await this.tryNotifyAgent(conversation, phoneNumberValue);
      await this.updateFunnelUserStage(funnelUserId, 'HANDOFF', agent?.whatsapp ?? null);

      logger.info('[HandleIncomingMessage] Handoff confirmed by user', { phone: phoneNumberValue });

      return {
        conversationId: conversation.id,
        userMessageId: userMessage.id.value,
        aiResponseId: '',
        aiResponseContent: HANDOFF_CONFIRMED_MSG,
      };
    }

    // User declined the advisor offer
    conversation = conversation.resetHandoffs();
    await this.conversationRepo.save(conversation);

    await this.messagingProvider.sendTextMessage({
      to: phoneNumberValue,
      body: HANDOFF_DECLINED_MSG,
    });

    await this.saveFunnelMessage(funnelUserId, HANDOFF_DECLINED_MSG, 'bot');

    logger.info('[HandleIncomingMessage] Handoff declined by user', { phone: phoneNumberValue });

    return {
      conversationId: conversation.id,
      userMessageId: userMessage.id.value,
      aiResponseId: '',
      aiResponseContent: HANDOFF_DECLINED_MSG,
    };
  }

  /** Returns true when the AI response is a HANDOFF_TRIGGER token. */
  private detectHandoffTrigger(text: string): boolean {
    const trimmed = text.trim();
    // Exact token formats from the prompts specification
    return (
      trimmed === 'HANDOFF_TRIGGER' ||
      trimmed === '<<HANDOFF_TRIGGER>>' ||
      // Tolerate minor surrounding whitespace / newlines
      /^HANDOFF_TRIGGER\s*$/.test(trimmed) ||
      /^<<HANDOFF_TRIGGER>>\s*$/.test(trimmed)
    );
  }

  /** Picks an active agent, sends them a WhatsApp notification, and returns the agent. */
  private async tryNotifyAgent(conversation: Conversation, leadPhone: string): Promise<Agent | null> {
    if (!this.agentRepo) return null;

    let agent: Agent | null = null;
    try {
      const agents = await this.agentRepo.findActive();
      if (agents.length === 0) {
        logger.warn('[HandleIncomingMessage] No active agents found for handoff notification');
        return null;
      }
      agent = agents[Math.floor(Math.random() * agents.length)]!;
    } catch (err) {
      logger.error('[HandleIncomingMessage] Failed to fetch agents for handoff', { error: err });
      return null;
    }

    const lastMessages = conversation.getLastNMessages(5);
    const summary = lastMessages
      .map((m) => {
        const role = m.role === 'user' ? 'Lead' : 'Angela';
        const snippet = m.content.length > 120 ? `${m.content.slice(0, 120)}…` : m.content;
        return `${role}: ${snippet}`;
      })
      .join('\n');

    const notification =
      `NUEVO LEAD PARA ATENDER\n\n` +
      `Telefono: ${leadPhone}\n\n` +
      `Resumen de la conversacion:\n${summary}\n\n` +
      `El lead ha solicitado ser contactado por un asesor. Por favor comunicate con el a la brevedad.`;

    try {
      await this.messagingProvider.sendTextMessage({ to: agent.whatsapp, body: notification });
      logger.info('[HandleIncomingMessage] Agent notified of handoff', {
        agent: agent.name,
        agentWhatsapp: agent.whatsapp,
        leadPhone,
      });
    } catch (err) {
      logger.error('[HandleIncomingMessage] Failed to send handoff notification to agent', {
        agent: agent.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return agent;
  }

  // ── Funnel helpers (fire-and-forget; errors logged but never thrown) ─────

  private async upsertFunnelUser(phoneNumber: string): Promise<string> {
    if (!this.funnelUserRepo) return '';
    try {
      return await this.funnelUserRepo.upsert({ senderId: phoneNumber });
    } catch (err) {
      logger.warn('[HandleIncomingMessage] Failed to upsert funnel_user', {
        error: err instanceof Error ? err.message : String(err),
      });
      return '';
    }
  }

  private async saveFunnelMessage(
    funnelUserId: string,
    text: string,
    role: 'user' | 'bot',
  ): Promise<void> {
    if (!this.funnelMessageRepo || !funnelUserId) return;
    try {
      if (role === 'user') {
        await this.funnelMessageRepo.saveUserMessage({ funnelUserId, text });
      } else {
        await this.funnelMessageRepo.saveBotMessage({ funnelUserId, text });
      }
    } catch (err) {
      logger.warn('[HandleIncomingMessage] Failed to save funnel_message', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async updateFunnelUserStage(
    funnelUserId: string,
    stage: 'AWARENESS' | 'CONSIDERATION' | 'DECISION' | 'HANDOFF' | 'CLOSED',
    assignedAgent: string | null,
  ): Promise<void> {
    if (!this.funnelUserRepo || !funnelUserId) return;
    try {
      await this.funnelUserRepo.updateById({ id: funnelUserId, stage, assignedAgent });
    } catch { /* ignore */ }
  }

  private async updateFunnelUserCategory(funnelUserId: string, purchaseCategory: string): Promise<void> {
    if (!this.funnelUserRepo || !funnelUserId) return;
    const stage = await this.funnelUserRepo.stageFromCategory(purchaseCategory);
    try {
      await this.funnelUserRepo.updateById({
        id: funnelUserId,
        stage,
        userCategory: purchaseCategory as 'first_contact' | 'interested' | 'ready_to_buy' | 'not_interested' | 'unknown',
      });
    } catch { /* ignore */ }
  }

  private async runMonolithicPrompt(
    conversation: Conversation,
    _userContent: string,
  ): Promise<{ content: string; model: string; totalTokens: number }> {
    // The user message is already stored in conversation.messages — use that window.
    const recentMessages = conversation.getLastNMessages(CONTEXT_WINDOW_SIZE);
    const chatHistory = recentMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
    const activeSystemPrompt = conversation.systemPrompt ?? FALLBACK_SYSTEM_PROMPT;
    const result = await this.aiProvider.complete([
      { role: 'system', content: activeSystemPrompt },
      ...chatHistory,
    ]);
    return { content: result.content, model: result.model, totalTokens: result.totalTokens };
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
