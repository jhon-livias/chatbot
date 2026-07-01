import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { logger } from '../shared/logger.js';
import type { Router } from 'express';

export interface ServerOptions {
  port: number;
  corsOrigins: string[];
}

export function createServer(webhookRouter: Router, options: ServerOptions): Express {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use((_req: Request, res: Response, next: NextFunction) => {
    const origins = options.corsOrigins;
    const origin = _req.headers['origin'];
    if (origin && origins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (_req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api', webhookRouter);

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('[HTTP] Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Internal Server Error' });
  });

  app.listen(options.port, () => {
    logger.info(`[HTTP] Server listening on port ${options.port}`);
  });

  return app;
}
