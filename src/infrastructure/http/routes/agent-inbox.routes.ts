import { Router, type Request, type Response } from 'express';
import { authenticateAgentJwt } from '../middlewares/authenticate-agent-jwt.middleware.js';
import { ListAgentInboxUseCase } from '../../../application/use-cases/agent-inbox/list-agent-inbox.usecase.js';
import { GetConversationHistoryUseCase } from '../../../application/use-cases/agent-inbox/get-conversation-history.usecase.js';
import { SendAgentMessageUseCase } from '../../../application/use-cases/agent-inbox/send-agent-message.usecase.js';
import { MarkConversationReadUseCase } from '../../../application/use-cases/agent-inbox/mark-conversation-read.usecase.js';
import { ReturnConversationToBotUseCase } from '../../../application/use-cases/agent-inbox/return-conversation-to-bot.usecase.js';
import { CloseConversationUseCase } from '../../../application/use-cases/agent-inbox/close-conversation.usecase.js';
import { ForbiddenError } from '../../../application/services/conversation-access.service.js';
import type { ConversationRepository } from '../../../domain/repositories/conversation.repository.js';
import type { MessagingProviderPort } from '../../../application/ports/messaging-provider.port.js';
import type { FunnelMessageMongoRepository } from '../../database/mongodb/repositories/funnel-message.mongo-repository.js';
import type { UserMongoRepository } from '../../database/mongodb/repositories/user.mongo-repository.js';
import type { FunnelUserMongoRepository } from '../../database/mongodb/repositories/funnel-user.mongo-repository.js';

export function createAgentInboxRouter(
  conversationRepo: ConversationRepository,
  userRepo: UserMongoRepository,
  funnelUserRepo: FunnelUserMongoRepository,
  messagingProvider: MessagingProviderPort,
  funnelMessageRepo: FunnelMessageMongoRepository,
): Router {
  const router = Router();

  const listInbox = new ListAgentInboxUseCase(conversationRepo, userRepo, funnelUserRepo);
  const getHistory = new GetConversationHistoryUseCase(conversationRepo, userRepo, funnelUserRepo);
  const sendMessage = new SendAgentMessageUseCase(conversationRepo, messagingProvider, funnelMessageRepo);
  const markRead = new MarkConversationReadUseCase(conversationRepo);
  const returnToBot = new ReturnConversationToBotUseCase(conversationRepo);
  const closeConv = new CloseConversationUseCase(conversationRepo);

  router.use('/api/v1', authenticateAgentJwt);

  // GET /api/v1/inbox
  router.get('/api/v1/inbox', async (req: Request, res: Response) => {
    const agentId = req.agent!.id;
    const limit = Number(req.query['limit'] ?? 20);
    const offset = Number(req.query['offset'] ?? 0);

    const result = await listInbox.execute({ agentId, limit, offset });
    res.json(result);
  });

  // GET /api/v1/conversations/:id
  router.get('/api/v1/conversations/:id', async (req: Request, res: Response) => {
    const agentId = req.agent!.id;
    const conversationId = String(req.params['id']);

    try {
      const result = await getHistory.execute({ conversationId, agentId, limit: 0 });
      res.json({ ...result, messages: undefined });
    } catch (err) {
      if (err instanceof ForbiddenError) {
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
      const result = await getHistory.execute({ conversationId, agentId, limit });
      res.json(result);
    } catch (err) {
      if (err instanceof ForbiddenError) {
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
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof ForbiddenError) {
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
        res.status(403).json({ error: err.message });
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
      res.json({ success: true, mode: 'bot' });
    } catch (err) {
      if (err instanceof ForbiddenError) {
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
      res.json({ success: true, status: 'closed' });
    } catch (err) {
      if (err instanceof ForbiddenError) {
        res.status(403).json({ error: err.message });
        return;
      }
      throw err;
    }
  });

  return router;
}
