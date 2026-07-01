import { Router } from 'express';
import type { WhatsAppController } from '../../webhooks/meta/whatsapp.controller.js';

export function createWebhookRouter(controller: WhatsAppController): Router {
  const router = Router();

  router.get('/webhook/whatsapp', (req, res) => controller.verify(req, res));
  router.post('/webhook/whatsapp', (req, res) => controller.receive(req, res));

  return router;
}
