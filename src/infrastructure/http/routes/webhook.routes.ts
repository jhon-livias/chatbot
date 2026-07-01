import { Router } from 'express';
import type { MetaWhatsAppController } from '../../webhooks/meta/meta-whatsapp.controller.js';

export function createWebhookRouter(controller: MetaWhatsAppController): Router {
  const router = Router();

  router.get('/webhook', (req, res) => controller.verify(req, res));
  router.post('/webhook', (req, res) => controller.receive(req, res));

  return router;
}
