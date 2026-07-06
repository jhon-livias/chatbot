import { connectMongoDB } from './infrastructure/database/mongodb/connection.js';
import { ConversationMongoRepository } from './infrastructure/database/mongodb/repositories/conversation.mongo-repository.js';
import { MessageMongoRepository } from './infrastructure/database/mongodb/repositories/message.mongo-repository.js';
import { UserMongoRepository } from './infrastructure/database/mongodb/repositories/user.mongo-repository.js';
import { ProgramMongoRepository } from './infrastructure/database/mongodb/repositories/program.mongo-repository.js';
import { AgentMongoRepository } from './infrastructure/database/mongodb/repositories/agent.mongo-repository.js';
import { PromptMongoRepository } from './infrastructure/database/mongodb/repositories/prompt.mongo-repository.js';
import { FunnelIntentionMongoRepository } from './infrastructure/database/mongodb/repositories/funnel-intention.mongo-repository.js';
import { ContextSourceDataMongoRepository } from './infrastructure/database/mongodb/repositories/context-source-data.mongo-repository.js';
import { FacultyMongoRepository } from './infrastructure/database/mongodb/repositories/faculty.mongo-repository.js';
import { FunnelUserMongoRepository } from './infrastructure/database/mongodb/repositories/funnel-user.mongo-repository.js';
import { FunnelMessageMongoRepository } from './infrastructure/database/mongodb/repositories/funnel-message.mongo-repository.js';
import { DeepSeekAdapter } from './infrastructure/ai/deepseek/deepseek.adapter.js';
import { loadDeepSeekConfig } from './infrastructure/ai/deepseek/deepseek.config.js';
import { TemplateService } from './infrastructure/ai/template/template.service.js';
import { MetaWhatsAppAdapter } from './infrastructure/webhooks/meta/meta-whatsapp.adapter.js';
import { MetaMediaService } from './infrastructure/webhooks/meta/meta-media.service.js';
import { LocalMediaStorage } from './infrastructure/storage/local-media.storage.js';
import { WhatsAppController } from './infrastructure/webhooks/meta/whatsapp.controller.js';
import { WhatsAppParserService } from './infrastructure/webhooks/meta/whatsapp-parser.service.js';
import { HandleIncomingMessageUseCase } from './application/use-cases/handle-incoming-message/handle-incoming-message.usecase.js';
import { HandleMessageStatusUseCase } from './application/use-cases/handle-message-status/handle-message-status.usecase.js';
import { SystemPromptBuilderService } from './application/services/system-prompt-builder.service.js';
import { IntentRouterService } from './application/services/intent-router.service.js';
import { RealtimeNotifier } from './application/services/realtime-notifier.service.js';
import { createWebhookRouter } from './infrastructure/http/routes/webhook.routes.js';
import { createAuthRouter } from './infrastructure/http/routes/auth.routes.js';
import { createAgentInboxRouter } from './infrastructure/http/routes/agent-inbox.routes.js';
import { createQuickRepliesRouter } from './infrastructure/http/routes/quick-replies.routes.js';
import { QuickReplyMongoRepository } from './infrastructure/database/mongodb/repositories/quick-reply.mongo-repository.js';
import { createServer } from './infrastructure/http/server.js';
import { WebSocketRealtimeAdapter } from './infrastructure/realtime/websocket-realtime.adapter.js';
import { logger } from './infrastructure/shared/logger.js';

async function bootstrap(): Promise<void> {
  await connectMongoDB({
    uri: process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/chatbot_uprit',
    dbName: process.env['MONGODB_DB_NAME'] ?? 'chatbot_uprit',
    maxPoolSize: Number(process.env['MONGODB_MAX_POOL_SIZE'] ?? 10),
    minPoolSize: Number(process.env['MONGODB_MIN_POOL_SIZE'] ?? 2),
  });

  const jwtSecret = process.env['JWT_SECRET'];
  if (!jwtSecret) throw new Error('JWT_SECRET environment variable is required');

  // ── Repositories ──────────────────────────────────────────────────────────
  const conversationRepo = new ConversationMongoRepository();
  const messageRepo = new MessageMongoRepository();
  const userRepo = new UserMongoRepository();
  const programRepo = new ProgramMongoRepository();
  const agentRepo = new AgentMongoRepository();
  const promptRepo = new PromptMongoRepository();
  const funnelIntentionRepo = new FunnelIntentionMongoRepository();
  const contextSourceRepo = new ContextSourceDataMongoRepository();
  const facultyRepo = new FacultyMongoRepository();
  const funnelUserRepo = new FunnelUserMongoRepository();
  const funnelMessageRepo = new FunnelMessageMongoRepository();
  const quickReplyRepo = new QuickReplyMongoRepository();

  // ── AI ────────────────────────────────────────────────────────────────────
  const deepSeekConfig = loadDeepSeekConfig();
  const templateService = new TemplateService();
  const deepSeekAdapter = new DeepSeekAdapter(deepSeekConfig);
  logger.info('[Bootstrap] AI engine initialized', { model: deepSeekConfig.model });

  const promptBuilder = new SystemPromptBuilderService();
  const intentRouter = new IntentRouterService(
    deepSeekAdapter,
    programRepo,
    promptRepo,
    funnelIntentionRepo,
    contextSourceRepo,
    facultyRepo,
  );

  // ── Messaging provider + Media ────────────────────────────────────────────
  const metaMediaConfig = {
    token: process.env['META_WHATSAPP_TOKEN'] ?? '',
    phoneNumberId: process.env['META_WHATSAPP_PHONE_NUMBER_ID'] ?? '',
    apiVersion: process.env['META_API_VERSION'] ?? 'v20.0',
    baseUrl: process.env['META_API_BASE_URL'] ?? 'https://graph.facebook.com',
  };
  const metaMediaService = new MetaMediaService(metaMediaConfig);
  const localMediaStorage = new LocalMediaStorage(
    process.env['MEDIA_STORAGE_PATH'] ?? '/app/uploads',
  );
  const metaAdapter = new MetaWhatsAppAdapter(metaMediaConfig, metaMediaService);

  logger.info('[Bootstrap] Media storage initialized', {
    path: process.env['MEDIA_STORAGE_PATH'] ?? '/app/uploads',
  });

  // ── Realtime: create adapter first (no httpServer yet), then notifier ─────
  const realtimeAdapter = new WebSocketRealtimeAdapter({
    jwtSecret,
    heartbeatMs: Number(process.env['WS_HEARTBEAT_MS'] ?? 30_000),
  });
  const realtimeNotifier = new RealtimeNotifier(realtimeAdapter);

  // ── Use cases ─────────────────────────────────────────────────────────────
  const handleIncomingMessage = new HandleIncomingMessageUseCase(
    conversationRepo,
    userRepo,
    deepSeekAdapter,
    metaAdapter,
    programRepo,
    promptBuilder,
    agentRepo,
    intentRouter,
    funnelUserRepo,
    funnelMessageRepo,
    messageRepo,
    realtimeNotifier,
    metaMediaService,
    localMediaStorage,
  );

  const handleMessageStatus = new HandleMessageStatusUseCase(
    messageRepo,
    conversationRepo,
    realtimeNotifier,
  );

  // ── HTTP + WebSocket ───────────────────────────────────────────────────────
  const whatsAppParser = new WhatsAppParserService();
  const whatsAppController = new WhatsAppController(
    whatsAppParser,
    handleIncomingMessage,
    handleMessageStatus,
    process.env['META_WEBHOOK_VERIFY_TOKEN'] ?? '',
  );

  const webhookRouter = createWebhookRouter(whatsAppController);
  const authRouter = createAuthRouter(agentRepo);
  const agentInboxRouter = createAgentInboxRouter(
    conversationRepo,
    userRepo,
    funnelUserRepo,
    agentRepo,
    metaAdapter,
    funnelMessageRepo,
    metaMediaService,
    localMediaStorage,
    realtimeNotifier,
  );
  const quickRepliesRouter = createQuickRepliesRouter(quickReplyRepo);

  const corsOrigins = [
    ...(process.env['CORS_ORIGINS'] ?? '').split(',').filter(Boolean),
    ...(process.env['ADMISION_CORS_ORIGIN'] ? [process.env['ADMISION_CORS_ORIGIN']] : []),
    'http://localhost:5173',
  ];

  const { httpServer } = createServer(webhookRouter, authRouter, agentInboxRouter, {
    port: Number(process.env['PORT'] ?? 3000),
    corsOrigins: [...new Set(corsOrigins)],
    mediaStoragePath: process.env['MEDIA_STORAGE_PATH'] ?? '/app/uploads',
  }, quickRepliesRouter);

  // start() receives httpServer now that it's ready
  realtimeAdapter.start(httpServer);
}

bootstrap().catch((err: unknown) => {
  logger.error('[Bootstrap] Fatal error starting application', { error: err });
  process.exit(1);
});
