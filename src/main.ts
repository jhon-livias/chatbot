import { connectMongoDB } from './infrastructure/database/mongodb/connection.js';
import { ConversationMongoRepository } from './infrastructure/database/mongodb/repositories/conversation.mongo-repository.js';
import { UserMongoRepository } from './infrastructure/database/mongodb/repositories/user.mongo-repository.js';
import { ProgramMongoRepository } from './infrastructure/database/mongodb/repositories/program.mongo-repository.js';
import { DeepSeekAdapter } from './infrastructure/ai/deepseek/deepseek.adapter.js';
import { DeepSeekService } from './infrastructure/ai/deepseek/deepseek.service.js';
import { loadDeepSeekConfig } from './infrastructure/ai/deepseek/deepseek.config.js';
import { TemplateService } from './infrastructure/ai/template/template.service.js';
import { MetaWhatsAppAdapter } from './infrastructure/webhooks/meta/meta-whatsapp.adapter.js';
import { WhatsAppController } from './infrastructure/webhooks/meta/whatsapp.controller.js';
import { WhatsAppParserService } from './infrastructure/webhooks/meta/whatsapp-parser.service.js';
import { HandleIncomingMessageUseCase } from './application/use-cases/handle-incoming-message/handle-incoming-message.usecase.js';
import { SystemPromptBuilderService } from './application/services/system-prompt-builder.service.js';
import { createWebhookRouter } from './infrastructure/http/routes/webhook.routes.js';
import { createServer } from './infrastructure/http/server.js';
import { logger } from './infrastructure/shared/logger.js';

async function bootstrap(): Promise<void> {
  await connectMongoDB({
    uri: process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/chatbot_uprit',
    dbName: process.env['MONGODB_DB_NAME'] ?? 'chatbot_uprit',
    maxPoolSize: Number(process.env['MONGODB_MAX_POOL_SIZE'] ?? 10),
    minPoolSize: Number(process.env['MONGODB_MIN_POOL_SIZE'] ?? 2),
  });

  const conversationRepo = new ConversationMongoRepository();
  const userRepo = new UserMongoRepository();
  const programRepo = new ProgramMongoRepository();

  const deepSeekConfig = loadDeepSeekConfig();
  const templateService = new TemplateService();
  const deepSeekAdapter = new DeepSeekAdapter(deepSeekConfig);
  const deepSeekService = new DeepSeekService(deepSeekConfig, templateService);
  logger.info('[Bootstrap] AI engine initialized', { model: deepSeekConfig.model });

  const promptBuilder = new SystemPromptBuilderService();

  const metaAdapter = new MetaWhatsAppAdapter({
    token: process.env['META_WHATSAPP_TOKEN'] ?? '',
    phoneNumberId: process.env['META_WHATSAPP_PHONE_NUMBER_ID'] ?? '',
    apiVersion: process.env['META_API_VERSION'] ?? 'v20.0',
    baseUrl: process.env['META_API_BASE_URL'] ?? 'https://graph.facebook.com',
  });

  const handleIncomingMessage = new HandleIncomingMessageUseCase(
    conversationRepo,
    userRepo,
    deepSeekAdapter,
    metaAdapter,
    programRepo,
    promptBuilder,
  );

  const whatsAppParser = new WhatsAppParserService();
  const whatsAppController = new WhatsAppController(
    whatsAppParser,
    handleIncomingMessage,
    process.env['META_WEBHOOK_VERIFY_TOKEN'] ?? '',
  );

  const webhookRouter = createWebhookRouter(whatsAppController);

  createServer(webhookRouter, {
    port: Number(process.env['PORT'] ?? 3000),
    corsOrigins: (process.env['CORS_ORIGINS'] ?? '').split(',').filter(Boolean),
  });
}

bootstrap().catch((err: unknown) => {
  logger.error('[Bootstrap] Fatal error starting application', { error: err });
  process.exit(1);
});
