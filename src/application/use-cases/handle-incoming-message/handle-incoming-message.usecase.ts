import { randomUUID } from 'node:crypto';
import type { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import type { UserRepository } from '../../../domain/repositories/user.repository.js';
import type { ProgramRepository } from '../../../domain/repositories/program.repository.js';
import type { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import type { AiProviderPort } from '../../ports/ai-provider.port.js';
import type { MessagingProviderPort } from '../../ports/messaging-provider.port.js';
import type { MediaStoragePort } from '../../ports/media-storage.port.js';
import type { SystemPromptBuilderService } from '../../services/system-prompt-builder.service.js';
import type { IntentRouterService } from '../../services/intent-router.service.js';
import type { FunnelUserMongoRepository } from '../../../infrastructure/database/mongodb/repositories/funnel-user.mongo-repository.js';
import type { FunnelMessageMongoRepository } from '../../../infrastructure/database/mongodb/repositories/funnel-message.mongo-repository.js';
import type { MessageRepository } from '../../../domain/repositories/message.repository.js';
import type { RealtimeNotifier } from '../../services/realtime-notifier.service.js';
import { PhoneNumber } from '../../../domain/value-objects/phone-number.vo.js';
import { MessageId } from '../../../domain/value-objects/message-id.vo.js';
import { User } from '../../../domain/entities/user.entity.js';
import { Message } from '../../../domain/entities/message.entity.js';
import type { MessageContentType } from '../../../domain/entities/message.entity.js';
import { Conversation } from '../../../domain/entities/conversation.entity.js';
import type { MetaMediaService } from '../../../infrastructure/webhooks/meta/meta-media.service.js';
import type {
  HandleIncomingMessageDto,
  HandleIncomingMessageResult,
} from './handle-incoming-message.dto.js';
import { formatWhatsAppText } from '../../../infrastructure/webhooks/meta/format-whatsapp-text.js';
import { logAgentAudit } from '../../../infrastructure/shared/agent-audit.logger.js';
import { resolveContactName } from '../../../infrastructure/shared/resolve-contact-name.js';
import { logger } from '../../../infrastructure/shared/logger.js';
import type { Agent } from '../../../domain/entities/agent.entity.js';
import type { HandoffBy } from '../../../domain/entities/conversation.entity.js';

const CONTEXT_WINDOW_SIZE = 10;
const MAX_CONSECUTIVE_HANDOFFS = 3;

const FALLBACK_SYSTEM_PROMPT =
  'Eres Angela, asesora estudiantil de UPRIT. Responde de manera concisa, amable y en el mismo idioma que el usuario. Usa texto plano sin markdown porque el canal es WhatsApp. ' +
  'REGLA CRITICA: Cuando no tengas informacion suficiente o el usuario pida hablar con un asesor, tu respuesta debe ser EXCLUSIVAMENTE el token: HANDOFF_TRIGGER — sin ningún texto antes ni después.';

const HANDOFF_CONFIRMATION_MSG =
  '¿Deseas que te contacte un asesor de admisiones para brindarte información personalizada? (Sí/No)';

const DEFAULT_HANDOFF_TRANSITION_MSG =
  'Te comunico con {agentName}, asesor de admisiones de la UPRIT. En un momento te atiende.';

const HANDOFF_DECLINED_MSG =
  'Entendido, con gusto seguiré ayudándote. ¿En qué más puedo asistirte?';

const HANDOFF_LOOP_MSG =
  'Veo que no he podido darte la información que buscas. Un asesor de admisiones se pondrá en contacto contigo para ayudarte de forma personalizada.';

const DEFAULT_AUTO_REPLY_UNSUPPORTED_MEDIA =
  'Recibí tu archivo. Por favor cuéntame en texto tu consulta o espera a un asesor.';

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
    private readonly messageRepo?: MessageRepository,
    private readonly realtimeNotifier?: RealtimeNotifier,
    private readonly metaMediaService?: MetaMediaService,
    private readonly mediaStorage?: MediaStoragePort,
  ) {}

  async execute(dto: HandleIncomingMessageDto): Promise<HandleIncomingMessageResult> {
    const phoneNumber = PhoneNumber.create(dto.fromPhoneNumber);

    // ── 1. Upsert user — always resolved before anything else ────────────
    let user = await this.userRepo.findByPhoneNumber(phoneNumber);
    if (!user) {
      user = User.create({
        id: randomUUID(),
        phoneNumber,
        ...(dto.profileName !== undefined && { name: dto.profileName }),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      user = await this.userRepo.save(user);
      logger.info('[HandleIncomingMessage] New user created', { phone: phoneNumber.value });
    } else if (dto.profileName && !user.name) {
      user = user.updateName(dto.profileName);
      user = await this.userRepo.save(user);
    }

    // ── 2. Upsert conversation — persist to DB immediately so context is never lost ──
    let conversation = await this.conversationRepo.findActiveByPhoneNumber(phoneNumber.value);
    let isFirstMessage = false;
    if (!conversation) {
      isFirstMessage = true;
      const systemPrompt = await this.buildSystemPrompt();
      conversation = Conversation.create({
        id: randomUUID(),
        userId: user.id,
        phoneNumber: phoneNumber.value,
        status: 'active',
        messages: [],
        systemPrompt,
        mode: 'bot',
        handoffState: 'none',
        consecutiveHandoffs: 0,
        assignedAgentId: null,
        handoffAt: null,
        handoffBy: null,
        lastUserMessageAt: null,
        lastAgentMessageAt: null,
        unreadCountAgent: 0,
        careerId: null,
        metaData: null,
        currentProgramName: null,
        labels: [],
        pinned: false,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      // Persist immediately so a simultaneous message won't create a duplicate conversation
      await this.conversationRepo.save(conversation);
      logger.info('[HandleIncomingMessage] New conversation created and persisted', {
        conversationId: conversation.id,
        phone: phoneNumber.value,
      });
    }

    // ── Idempotency: skip duplicate Meta message IDs ─────────────────────
    if (this.messageRepo && dto.externalMessageId) {
      const existing = await this.messageRepo.findByExternalId(dto.externalMessageId);
      if (existing) {
        logger.debug('[HandleIncomingMessage] Duplicate externalMessageId — skipping', {
          externalMessageId: dto.externalMessageId,
          conversationId: existing.conversationId,
        });
        return {
          conversationId: existing.conversationId,
          userMessageId: existing.id.value,
          aiResponseId: '',
          aiResponseContent: '',
        };
      }
    }

    // ── 3. Human mode: bot silenced — queue message for assigned agent ───
    if (conversation.isHumanMode()) {
      return this.handleHumanModeInbound(conversation, dto, phoneNumber.value);
    }

    // ── 4. Handoff pending: user is answering the yes/no confirmation ────
    if (conversation.handoffState === 'pending') {
      return this.handlePendingHandoffReply(conversation, dto, phoneNumber.value);
    }

    // ── 5. Bot mode + non-text media: auto-reply, no DeepSeek ────────────
    if (this.isNonTextMedia(dto)) {
      return this.handleBotModeMediaInbound(conversation, dto, phoneNumber.value);
    }

    // --- Normal text message processing ---
    const userMessage = await this.createUserMessage(conversation, dto);

    conversation = conversation
      .addMessage(userMessage)
      .withLastUserMessageAt(new Date(dto.timestamp));
    await this.conversationRepo.save(conversation);

    // ── Upsert funnel_users so the admin panel can see this lead ──────────
    const funnelUserId = await this.upsertFunnelUser(phoneNumber.value, dto.profileName);

    // Save the inbound message to funnel_messages
    await this.saveFunnelMessage(
      funnelUserId,
      dto.content,
      'user',
      this.funnelMediaMeta(dto, userMessage.mediaUrl),
    );

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
          isFirstMessage,
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

    // Strip any HANDOFF_TRIGGER token suffix the model may have appended to a normal response.
    // This keeps the conversation history clean regardless of what the model format chose.
    const aiContentClean = aiContent
      .replace(/\s*<<HANDOFF_TRIGGER>>\s*$/g, '')
      .replace(/\s*HANDOFF_TRIGGER\s*$/g, '')
      .trim();

    const isHandoff = this.detectHandoffTrigger(aiContent);

    if (isHandoff) {
      const newConsecutive = conversation.consecutiveHandoffs + 1;

      if (newConsecutive >= MAX_CONSECUTIVE_HANDOFFS) {
        logger.warn('[HandleIncomingMessage] Loop detected — triggering automatic handoff', {
          phone: phoneNumber.value,
          consecutiveHandoffs: newConsecutive,
        });

        const funnelUserId = await this.upsertFunnelUser(phoneNumber.value, dto.profileName);
        return this.activateHumanHandoff({
          conversation: conversation.incrementHandoffs(),
          phoneNumberValue: phoneNumber.value,
          funnelUserId,
          handoffBy: 'bot',
          leadMessage: HANDOFF_LOOP_MSG,
          userMessage,
        });
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
      content: aiContentClean,
      status: 'processing',
      timestamp: new Date(),
      metadata: { model: aiModel, tokens: aiTokens },
    });

    conversation = conversation
      .addMessage(assistantMessage)
      .resetHandoffs()
      .withIntentContext(newCareerId, newMetaData, newProgramName);
    await this.conversationRepo.save(conversation);

    const replyText = formatWhatsAppText(aiContentClean);

    const sendResult = await this.messagingProvider.sendTextMessage({
      to: phoneNumber.value,
      body: replyText,
    });

    if (this.messageRepo && sendResult.messageId) {
      const sentMessage = assistantMessage
        .withExternalId(sendResult.messageId)
        .markAs('sent');
      await this.messageRepo.save(sentMessage);

      this.realtimeNotifier?.notifyNewMessage({
        conversationId: conversation.id,
        conversationMode: conversation.mode,
        assignedAgentId: conversation.assignedAgentId,
        message: sentMessage,
      });
    }

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
    if (this.isNonTextMedia(dto) && !dto.caption?.trim()) {
      return this.handleBotModeMediaInbound(conversation, dto, phoneNumberValue);
    }

    const userMessage = await this.createUserMessage(conversation, dto);

    conversation = conversation
      .addMessage(userMessage)
      .withLastUserMessageAt(new Date(dto.timestamp));

    // Ensure funnel user exists for this phone
    const funnelUserId = await this.upsertFunnelUser(phoneNumberValue, dto.profileName);
    await this.saveFunnelMessage(
      funnelUserId,
      dto.content,
      'user',
      this.funnelMediaMeta(dto, userMessage.mediaUrl),
    );

    const replyText = dto.caption?.trim() || dto.content;
    const isAffirmative = AFFIRMATIVE_PATTERN.test(replyText.trim());

    if (isAffirmative) {
      const agent = await this.pickAgent();
      const transitionMsg = agent
        ? this.buildHandoffTransitionMessage(agent.name)
        : 'Un asesor de admisiones de la UPRIT te atenderá en breve.';

      return this.activateHumanHandoff({
        conversation,
        phoneNumberValue,
        funnelUserId,
        handoffBy: 'user',
        leadMessage: transitionMsg,
        userMessage,
        agent,
      });
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

  /** Inbound message while conversation is in human mode — no AI, no auto-reply. */
  private async handleHumanModeInbound(
    conversation: Conversation,
    dto: HandleIncomingMessageDto,
    phoneNumberValue: string,
  ): Promise<HandleIncomingMessageResult> {
    const userMessage = await this.createUserMessage(conversation, dto);

    conversation = conversation
      .addMessage(userMessage)
      .withLastUserMessageAt(new Date(dto.timestamp))
      .incrementUnread();
    await this.conversationRepo.save(conversation);

    this.realtimeNotifier?.notifyNewMessage({
      conversationId: conversation.id,
      conversationMode: conversation.mode,
      assignedAgentId: conversation.assignedAgentId,
      message: userMessage,
    });

    const funnelUserId = await this.upsertFunnelUser(phoneNumberValue, dto.profileName);
    await this.saveFunnelMessage(
      funnelUserId,
      dto.content,
      'user',
      this.funnelMediaMeta(dto, userMessage.mediaUrl),
    );

    logger.info('[HandleIncomingMessage] Human mode — message queued for agent', {
      phone: phoneNumberValue,
      conversationId: conversation.id,
      assignedAgentId: conversation.assignedAgentId,
      unreadCount: conversation.unreadCountAgent,
    });

    return {
      conversationId: conversation.id,
      userMessageId: userMessage.id.value,
      aiResponseId: '',
      aiResponseContent: '',
    };
  }

  private async activateHumanHandoff(params: {
    conversation: Conversation;
    phoneNumberValue: string;
    funnelUserId: string;
    handoffBy: HandoffBy;
    leadMessage: string;
    userMessage: Message;
    agent?: Agent | null;
  }): Promise<HandleIncomingMessageResult> {
    const agent = params.agent ?? await this.pickAgent();
    let conversation = params.conversation.withHumanHandoff(agent?.id ?? null, params.handoffBy);
    await this.conversationRepo.save(conversation);

    await this.messagingProvider.sendTextMessage({
      to: params.phoneNumberValue,
      body: params.leadMessage,
    });

    await this.saveFunnelMessage(params.funnelUserId, params.leadMessage, 'bot');
    await this.updateFunnelUserStage(params.funnelUserId, 'HANDOFF', agent?.id ?? null);

    if (agent) {
      await this.tryNotifyAgent(conversation, params.phoneNumberValue, agent);
    }

    logger.info('[HandleIncomingMessage] Human handoff activated', {
      phone: params.phoneNumberValue,
      conversationId: conversation.id,
      assignedAgentId: agent?.id ?? null,
      handoffBy: params.handoffBy,
    });

    if (agent && this.funnelUserRepo) {
      const contactName = await resolveContactName(
        params.phoneNumberValue,
        conversation.userId,
        this.funnelUserRepo,
        this.userRepo,
      );
      logAgentAudit({
        action: 'conversation_assigned',
        agentId: agent.id,
        agentName: agent.name,
        conversationId: conversation.id,
        phoneNumber: params.phoneNumberValue,
        handoffBy: params.handoffBy,
        ...(contactName ? { contactName } : {}),
      });
    }

    return {
      conversationId: conversation.id,
      userMessageId: params.userMessage.id.value,
      aiResponseId: '',
      aiResponseContent: params.leadMessage,
    };
  }

  private buildHandoffTransitionMessage(agentName: string): string {
    const template =
      process.env['HANDOFF_TRANSITION_MESSAGE'] ?? DEFAULT_HANDOFF_TRANSITION_MSG;
    return template.replaceAll('{agentName}', agentName);
  }

  private isNonTextMedia(dto: HandleIncomingMessageDto): boolean {
    return (dto.contentType ?? 'text') !== 'text';
  }

  private getAutoReplyUnsupportedMedia(): string {
    return process.env['AUTO_REPLY_UNSUPPORTED_MEDIA'] ?? DEFAULT_AUTO_REPLY_UNSUPPORTED_MEDIA;
  }

  private funnelMediaMeta(
    dto: HandleIncomingMessageDto,
    mediaUrl?: string,
  ): { contentType?: MessageContentType; mediaUrl?: string } {
    return {
      ...(dto.contentType !== undefined && { contentType: dto.contentType }),
      ...(mediaUrl !== undefined && { mediaUrl }),
    };
  }

  /** Bot mode inbound for image/document/audio/video/sticker — no DeepSeek. */
  private async handleBotModeMediaInbound(
    conversation: Conversation,
    dto: HandleIncomingMessageDto,
    phoneNumberValue: string,
  ): Promise<HandleIncomingMessageResult> {
    const userMessage = await this.createUserMessage(conversation, dto);

    conversation = conversation
      .addMessage(userMessage)
      .withLastUserMessageAt(new Date(dto.timestamp));
    await this.conversationRepo.save(conversation);

    const funnelUserId = await this.upsertFunnelUser(phoneNumberValue, dto.profileName);
    await this.saveFunnelMessage(
      funnelUserId,
      dto.content,
      'user',
      this.funnelMediaMeta(dto, userMessage.mediaUrl),
    );

    const autoReply = this.getAutoReplyUnsupportedMedia();
    await this.messagingProvider.sendTextMessage({
      to: phoneNumberValue,
      body: autoReply,
    });
    await this.saveFunnelMessage(funnelUserId, autoReply, 'bot');

    return {
      conversationId: conversation.id,
      userMessageId: userMessage.id.value,
      aiResponseId: '',
      aiResponseContent: autoReply,
    };
  }

  private async createUserMessage(
    conversation: Conversation,
    dto: HandleIncomingMessageDto,
  ): Promise<Message> {
    const contentType = dto.contentType ?? 'text';
    const mediaFields = await this.resolveMediaFields(conversation.id, dto);

    return Message.create({
      id: MessageId.generate(),
      conversationId: conversation.id,
      externalId: dto.externalMessageId,
      role: 'user',
      content: dto.content,
      contentType,
      ...(mediaFields.mediaUrl !== undefined && { mediaUrl: mediaFields.mediaUrl }),
      ...(mediaFields.mimeType !== undefined && { mimeType: mediaFields.mimeType }),
      ...(dto.fileName !== undefined && { fileName: dto.fileName }),
      ...(dto.caption !== undefined && { caption: dto.caption }),
      status: 'received',
      timestamp: new Date(dto.timestamp),
    });
  }

  private async resolveMediaFields(
    conversationId: string,
    dto: HandleIncomingMessageDto,
  ): Promise<{ mediaUrl?: string; mimeType?: string }> {
    const contentType = dto.contentType ?? 'text';
    if (contentType !== 'image' && contentType !== 'document') {
      return { ...(dto.mimeType !== undefined && { mimeType: dto.mimeType }) };
    }
    if (!dto.mediaId || !this.metaMediaService || !this.mediaStorage) {
      return { ...(dto.mimeType !== undefined && { mimeType: dto.mimeType }) };
    }

    try {
      const { buffer, mimeType } = await this.metaMediaService.downloadMedia(dto.mediaId);
      const resolvedMimeType = mimeType ?? dto.mimeType ?? 'application/octet-stream';
      const saved = await this.mediaStorage.save(buffer, {
        mimeType: resolvedMimeType,
        conversationId,
        ...(dto.fileName !== undefined && { originalName: dto.fileName }),
      });

      logger.info('[WhatsApp] Media received', {
        contentType,
        mimeType: resolvedMimeType,
        conversationId,
      });

      return { mediaUrl: saved.publicPath, mimeType: resolvedMimeType };
    } catch (err) {
      logger.error('[HandleIncomingMessage] Failed to download/save media', {
        conversationId,
        mediaId: dto.mediaId,
        contentType,
        error: err instanceof Error ? err.message : String(err),
      });
      return { ...(dto.mimeType !== undefined && { mimeType: dto.mimeType }) };
    }
  }

  private async pickAgent(): Promise<Agent | null> {
    if (!this.agentRepo) return null;
    try {
      const agents = await this.agentRepo.findActive();
      if (agents.length === 0) {
        logger.warn('[HandleIncomingMessage] No active agents found for handoff');
        return null;
      }
      return agents[Math.floor(Math.random() * agents.length)]!;
    } catch (err) {
      logger.error('[HandleIncomingMessage] Failed to fetch agents for handoff', { error: err });
      return null;
    }
  }

  /** Returns true when the AI response contains a HANDOFF_TRIGGER token anywhere. */
  private detectHandoffTrigger(text: string): boolean {
    // Handle both token formats, whether the model puts them alone or at the end of a sentence
    return /HANDOFF_TRIGGER/.test(text) || /<<HANDOFF_TRIGGER>>/.test(text);
  }

  /** Sends a WhatsApp alert to the assigned agent with panel link and conversation summary. */
  private async tryNotifyAgent(
    conversation: Conversation,
    leadPhone: string,
    agent: Agent,
  ): Promise<void> {
    const panelBase = (process.env['ADMISION_PANEL_URL'] ?? 'https://admision.uprit.edu.pe').replace(/\/$/, '');
    const inboxUrl = `${panelBase}/inbox`;

    const lastMessages = conversation.getLastNMessages(5);
    const summary = lastMessages
      .map((m) => {
        const role = m.role === 'user' ? 'Lead' : 'Angela';
        const snippet = m.content.length > 120 ? `${m.content.slice(0, 120)}…` : m.content;
        return `${role}: ${snippet}`;
      })
      .join('\n');

    const notification =
      `NUEVO CHAT ASIGNADO\n\n` +
      `Lead: ${leadPhone}\n` +
      `Conversacion: ${conversation.id}\n\n` +
      `Resumen:\n${summary}\n\n` +
      `Atiende desde el panel:\n${inboxUrl}`;

    try {
      await this.messagingProvider.sendTextMessage({ to: agent.whatsapp, body: notification });
      logger.info('[HandleIncomingMessage] Agent notified of handoff', {
        agent: agent.name,
        agentId: agent.id,
        leadPhone,
        inboxUrl,
      });
    } catch (err) {
      logger.error('[HandleIncomingMessage] Failed to send handoff notification to agent', {
        agent: agent.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── Funnel helpers (fire-and-forget; errors logged but never thrown) ─────

  private async upsertFunnelUser(phoneNumber: string, profileName?: string): Promise<string> {
    if (!this.funnelUserRepo) return '';
    try {
      return await this.funnelUserRepo.upsert({
        senderId: phoneNumber,
        ...(profileName !== undefined && { name: profileName }),
      });
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
    media?: { contentType?: MessageContentType; mediaUrl?: string },
  ): Promise<void> {
    if (!this.funnelMessageRepo || !funnelUserId) return;
    try {
      if (role === 'user') {
        await this.funnelMessageRepo.saveUserMessage({
          funnelUserId,
          text,
          ...(media?.contentType !== undefined && { contentType: media.contentType }),
          ...(media?.mediaUrl !== undefined && { mediaUrl: media.mediaUrl }),
        });
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
    // Always rebuild system prompt with fresh data from DB so every message
    // has the latest program/admission context injected — never use a stale stored copy.
    const freshSystemPrompt = await this.buildSystemPrompt();

    const recentMessages = conversation.getLastNMessages(CONTEXT_WINDOW_SIZE);
    const chatHistory = recentMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
    const result = await this.aiProvider.complete([
      { role: 'system', content: freshSystemPrompt },
      ...chatHistory,
    ]);
    return { content: result.content, model: result.model, totalTokens: result.totalTokens };
  }

  private async buildSystemPrompt(): Promise<string> {
    if (!this.programRepo || !this.promptBuilder) {
      logger.warn('[HandleIncomingMessage] programRepo or promptBuilder not available — using fallback prompt');
      return FALLBACK_SYSTEM_PROMPT;
    }
    try {
      const programs = await this.programRepo.findActive();
      const prompt = this.promptBuilder.build(programs);
      logger.info('[HandleIncomingMessage] System prompt built fresh from DB', {
        programs: programs.length,
        promptLength: prompt.length,
      });
      return prompt;
    } catch (err) {
      logger.warn('[HandleIncomingMessage] Failed to load programs — using base prompt without program data', {
        error: err instanceof Error ? err.message : String(err),
      });
      // Use the safe base instructions (no HANDOFF_TRIGGER for lack of data) rather than
      // the aggressive fallback that triggers handoff on any insufficient-info scenario.
      return this.promptBuilder.build([]);
    }
  }
}
