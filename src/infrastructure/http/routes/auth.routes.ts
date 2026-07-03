import { Router, type Request, type Response } from 'express';
import {
  LoginAgentUseCase,
  UnauthorizedError,
} from '../../../application/use-cases/agent-auth/login-agent.usecase.js';
import type { AgentRepository } from '../../../domain/repositories/agent.repository.js';

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
      res.json(result);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        res.status(401).json({ error: err.message });
        return;
      }
      throw err;
    }
  });

  router.post('/api/v1/auth/logout', (_req: Request, res: Response) => {
    res.json({ message: 'Sesión cerrada correctamente' });
  });

  return router;
}
