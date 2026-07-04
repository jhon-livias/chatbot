import { Router, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import {
  LoginAgentUseCase,
  UnauthorizedError,
} from '../../../application/use-cases/agent-auth/login-agent.usecase.js';
import type { AgentRepository } from '../../../domain/repositories/agent.repository.js';
import { clientIp, logAgentAudit } from '../../shared/agent-audit.logger.js';

export function createAuthRouter(agentRepo: AgentRepository): Router {
  const router = Router();
  const loginUseCase = new LoginAgentUseCase(agentRepo);

  router.post('/api/v1/auth/login', async (req: Request, res: Response) => {
    const { username, password } = req.body as { username?: string; password?: string };

    if (!username || !password) {
      res.status(400).json({ error: 'username y password son requeridos' });
      return;
    }

    try {
      const result = await loginUseCase.execute({ username, password });
      logAgentAudit({
        action: 'login_success',
        agentId: result.agent.id,
        agentUsername: result.agent.username,
        agentName: result.agent.name,
        ip: clientIp(req),
      });
      res.json(result);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        logAgentAudit({
          action: 'login_failed',
          agentUsername: username.toLowerCase().trim(),
          detail: err.message,
          ip: clientIp(req),
        });
        res.status(401).json({ error: err.message });
        return;
      }
      throw err;
    }
  });

  router.post('/api/v1/auth/logout', (req: Request, res: Response) => {
    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const secret = process.env['JWT_SECRET'];
        if (secret) {
          const payload = jwt.verify(authHeader.slice(7), secret) as {
            sub: string;
            username: string;
            name: string;
          };
          logAgentAudit({
            action: 'logout',
            agentId: payload.sub,
            agentUsername: payload.username,
            agentName: payload.name,
            ip: clientIp(req),
          });
        }
      } catch {
        // Token inválido en logout — no bloquear respuesta
      }
    }
    res.json({ message: 'Sesión cerrada correctamente' });
  });

  return router;
}
