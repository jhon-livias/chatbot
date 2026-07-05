import { Router, type Request, type Response } from 'express';
import { authenticateAgentJwt } from '../middlewares/authenticate-agent-jwt.middleware.js';
import { ListAgentInboxUseCase } from '../../../application/use-cases/agent-inbox/list-agent-inbox.usecase.js';
import { GetConversationHistoryUseCase } from '../../../application/use-cases/agent-inbox/get-conversation-history.usecase.js';
import { SendAgentMessageUseCase } from '../../../application/use-cases/agent-inbox/send-agent-message.usecase.js';
import { MarkConversationReadUseCase } from '../../../application/use-cases/agent-inbox/mark-conversation-read.usecase.js';
import { ReturnConversationToBotUseCase } from '../../../application/use-cases/agent-inbox/return-conversation-to-bot.usecase.js';
import { TakeConversationUseCase } from '../../../application/use-cases/agent-inbox/take-conversation.usecase.js';
import { CloseConversationUseCase } from '../../../application/use-cases/agent-inbox/close-conversation.usecase.js';
import { ForbiddenError } from '../../../application/services/conversation-access.service.js';
import type { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import type { MessagingProviderPort } from '../../../application/ports/messaging-provider.port.js';
import type { FunnelMessageMongoRepository } from '../../database/mongodb/repositories/funnel-message.mongo-repository.js';
import type { UserMongoRepository } from '../../database/mongodb/repositories/user.mongo-repository.js';
import type { FunnelUserMongoRepository } from '../../database/mongodb/repositories/funnel-user.mongo-repository.js';
import { logAgentAuditFromRequest, type AgentAuditFields } from '../../shared/agent-audit.logger.js';
import { resolveContactName } from '../../shared/resolve-contact-name.js';
import type { UserRepository } from '../../../domain/repositories/user.repository.js';
import type { AgentRepository } from '../../../domain/repositories/agent.repository.js';

async function auditConversationAction(
  conversationRepo: ConversationRepository,
  userRepo: UserRepository,
  funnelUserRepo: FunnelUserMongoRepository,
  req: Request,
  conversationId: string,
  action: 'message_sent' | 'return_to_bot' | 'conversation_closed' | 'access_denied',
  extra?: { contentPreview?: string; detail?: string },
): Promise<void> {
  const conversation = await conversationRepo.findById(conversationId);
  const auditExtra: Omit<AgentAuditFields, 'action'> = { conversationId, ...extra };
  if (conversation?.phoneNumber) {
    auditExtra.phoneNumber = conversation.phoneNumber;
    const contactName = await resolveContactName(
      conversation.phoneNumber,
      conversation.userId,
      funnelUserRepo,
      userRepo,
    );
    if (contactName) auditExtra.contactName = contactName;
  }
  logAgentAuditFromRequest(req, action, auditExtra);
}

export function createAgentInboxRouter(
  conversationRepo: ConversationRepository,
  userRepo: UserMongoRepository,
  funnelUserRepo: FunnelUserMongoRepository,
  agentRepo: AgentRepository,
  messagingProvider: MessagingProviderPort,
  funnelMessageRepo: FunnelMessageMongoRepository,
): Router {
  const router = Router();

  const listInbox = new ListAgentInboxUseCase(conversationRepo, userRepo, funnelUserRepo, agentRepo);
  const getHistory = new GetConversationHistoryUseCase(conversationRepo, userRepo, funnelUserRepo, agentRepo);
  const sendMessage = new SendAgentMessageUseCase(conversationRepo, messagingProvider, funnelMessageRepo);
  const markRead = new MarkConversationReadUseCase(conversationRepo);
  const returnToBot = new ReturnConversationToBotUseCase(conversationRepo);
  const takeConversation = new TakeConversationUseCase(conversationRepo, funnelUserRepo);
  const closeConv = new CloseConversationUseCase(conversationRepo);

  router.use('/api/v1', authenticateAgentJwt);

  // GET /api/v1/inbox
  router.get('/api/v1/inbox', async (req: Request, res: Response) => {
    const agentId = req.agent!.id;
    const role = req.agent!.role;
    const filterRaw = req.query['filter'];
    const inboxFilter =
      filterRaw === 'bot' || filterRaw === 'own' ? filterRaw : undefined;
    const defaultLimit = role === 'admin' ? 100 : inboxFilter === 'bot' ? 100 : 20;
    const limit = Number(req.query['limit'] ?? defaultLimit);
    const offset = Number(req.query['offset'] ?? 0);
    const sinceRaw = req.query['since'];
    const since =
      typeof sinceRaw === 'string' && sinceRaw.trim()
        ? new Date(sinceRaw)
        : undefined;

    const result = await listInbox.execute({
      agentId,
      role,
      limit,
      offset,
      ...(since !== undefined && { since }),
      ...(inboxFilter !== undefined && { inboxFilter }),
    });
    res.json(result);
  });

  // GET /api/v1/conversations/:id
  router.get('/api/v1/conversations/:id', async (req: Request, res: Response) => {
    const agentId = req.agent!.id;
    const conversationId = String(req.params['id']);

    try {
      const result = await getHistory.execute({ conversationId, agentId, role: req.agent!.role, limit: 0 });
      res.json({ ...result, messages: undefined });
    } catch (err) {
      if (err instanceof ForbiddenError) {
        await auditConversationAction(conversationRepo, userRepo, funnelUserRepo, req, conversationId, 'access_denied', {
          detail: err.message,
        });
        res.status(403).json({ error: err.message });
        return;
      }
      if (err instanceof Error && err.message === 'Conversación no encontrada') {
        res.status(404).json({ error: err.message });
        return;
      }
      throw err;
    }
  });

  // GET /api/v1/conversations/:id/messages
  router.get('/api/v1/conversations/:id/messages', async (req: Request, res: Response) => {
    const agentId = req.agent!.id;
    const conversationId = String(req.params['id']);
    const limit = req.query['limit'] ? Number(req.query['limit']) : undefined;

    try {
      const result = await getHistory.execute({ conversationId, agentId, role: req.agent!.role, limit });
      res.json(result);
    } catch (err) {
      if (err instanceof ForbiddenError) {
        await auditConversationAction(conversationRepo, userRepo, funnelUserRepo, req, conversationId, 'access_denied', {
          detail: err.message,
        });
        res.status(403).json({ error: err.message });
        return;
      }
      if (err instanceof Error && err.message === 'Conversación no encontrada') {
        res.status(404).json({ error: err.message });
        return;
      }
      throw err;
    }
  });

  // POST /api/v1/conversations/:id/messages
  router.post('/api/v1/conversations/:id/messages', async (req: Request, res: Response) => {
    const agentId = req.agent!.id;
    const conversationId = String(req.params['id']);
    const { content } = req.body as { content?: string };

    if (!content?.trim()) {
      res.status(400).json({ error: 'content es requerido' });
      return;
    }

    try {
      const result = await sendMessage.execute({ conversationId, agentId, content });
      await auditConversationAction(conversationRepo, userRepo, funnelUserRepo, req, conversationId, 'message_sent', {
        contentPreview: content.trim().slice(0, 120),
      });
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof ForbiddenError) {
        await auditConversationAction(conversationRepo, userRepo, funnelUserRepo, req, conversationId, 'access_denied', {
          detail: err.message,
        });
        res.status(403).json({ error: err.message });
        return;
      }
      if (err instanceof Error && err.message === 'Conversación no encontrada') {
        res.status(404).json({ error: err.message });
        return;
      }
      throw err;
    }
  });

  // POST /api/v1/conversations/:id/read
  router.post('/api/v1/conversations/:id/read', async (req: Request, res: Response) => {
    const agentId = req.agent!.id;
    const conversationId = String(req.params['id']);

    try {
      await markRead.execute({ conversationId, agentId });
      res.json({ success: true });
    } catch (err) {
      if (err instanceof ForbiddenError) {
        await auditConversationAction(conversationRepo, userRepo, funnelUserRepo, req, conversationId, 'access_denied', {
          detail: err.message,
        });
        res.status(403).json({ error: err.message });
        return;
      }
      throw err;
    }
  });

  // POST /api/v1/conversations/:id/take
  router.post('/api/v1/conversations/:id/take', async (req: Request, res: Response) => {
    const agentId = req.agent!.id;
    const conversationId = String(req.params['id']);

    try {
      const result = await takeConversation.execute({ conversationId, agentId });
      const conversation = await conversationRepo.findById(conversationId);
      const auditExtra: Omit<AgentAuditFields, 'action'> = {
        conversationId,
        handoffBy: 'agent',
      };
      if (conversation?.phoneNumber) {
        auditExtra.phoneNumber = conversation.phoneNumber;
        const contactName = await resolveContactName(
          conversation.phoneNumber,
          conversation.userId,
          funnelUserRepo,
          userRepo,
        );
        if (contactName) auditExtra.contactName = contactName;
      }
      logAgentAuditFromRequest(req, 'conversation_assigned', auditExtra);
      res.json(result);
    } catch (err) {
      if (err instanceof Error && err.message === 'Conversación no encontrada') {
        res.status(404).json({ error: err.message });
        return;
      }
      if (err instanceof Error && err.message === 'Este chat ya está en atención humana') {
        res.status(409).json({ error: err.message });
        return;
      }
      throw err;
    }
  });

  // POST /api/v1/conversations/:id/return-to-bot
  router.post('/api/v1/conversations/:id/return-to-bot', async (req: Request, res: Response) => {
    const agentId = req.agent!.id;
    const conversationId = String(req.params['id']);

    try {
      await returnToBot.execute({ conversationId, agentId });
      await auditConversationAction(conversationRepo, userRepo, funnelUserRepo, req, conversationId, 'return_to_bot');
      res.json({ success: true, mode: 'bot' });
    } catch (err) {
      if (err instanceof ForbiddenError) {
        await auditConversationAction(conversationRepo, userRepo, funnelUserRepo, req, conversationId, 'access_denied', {
          detail: err.message,
        });
        res.status(403).json({ error: err.message });
        return;
      }
      throw err;
    }
  });

  // POST /api/v1/conversations/:id/close
  router.post('/api/v1/conversations/:id/close', async (req: Request, res: Response) => {
    const agentId = req.agent!.id;
    const conversationId = String(req.params['id']);

    try {
      await closeConv.execute({ conversationId, agentId });
      await auditConversationAction(conversationRepo, userRepo, funnelUserRepo, req, conversationId, 'conversation_closed');
      res.json({ success: true, status: 'closed' });
    } catch (err) {
      if (err instanceof ForbiddenError) {
        await auditConversationAction(conversationRepo, userRepo, funnelUserRepo, req, conversationId, 'access_denied', {
          detail: err.message,
        });
        res.status(403).json({ error: err.message });
        return;
      }
      throw err;
    }
  });

  return router;
}
