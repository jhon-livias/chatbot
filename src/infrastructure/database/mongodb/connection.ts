import mongoose from 'mongoose';
import { logger } from '../../shared/logger.js';

export interface MongoConfig {
  uri: string;
  dbName: string;
  maxPoolSize?: number;
  minPoolSize?: number;
}

/**
 * Conecta a MongoDB (local o Atlas).
 *
 * URI local:  mongodb://localhost:27017/chatbot_uprit
 * URI Atlas:  mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
 *
 * Con `mongodb+srv://`, Mongoose activa TLS automáticamente y hereda
 * `retryWrites` y `w` desde la cadena de conexión de Atlas.
 */
export async function connectMongoDB(config: MongoConfig): Promise<void> {
  const isAtlas = config.uri.startsWith('mongodb+srv://');

  mongoose.connection.on('connected', () =>
    logger.info(`[MongoDB] Conectado a "${config.dbName}" ${isAtlas ? '(Atlas)' : '(local)'}`),
  );
  mongoose.connection.on('error', (err) =>
    logger.error('[MongoDB] Error de conexión', { error: err }),
  );
  mongoose.connection.on('disconnected', () =>
    logger.warn('[MongoDB] Desconectado'),
  );

  await mongoose.connect(config.uri, {
    dbName: config.dbName,
    maxPoolSize: config.maxPoolSize ?? 10,
    minPoolSize: config.minPoolSize ?? 2,
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
    // Atlas requiere estos flags; para local no tienen efecto negativo
    retryWrites: true,
    writeConcern: { w: 'majority' },
  });
}

export async function disconnectMongoDB(): Promise<void> {
  await mongoose.disconnect();
  logger.info('[MongoDB] Conexión cerrada correctamente');
}
