/**
 * Script de inicialización de datos base.
 * Ejecutar: node --env-file=.env dist/infrastructure/database/mongodb/seeders/run-seeders.js
 */
import { connectMongoDB, disconnectMongoDB } from '../connection.js';
import { IntencionMongoRepository } from '../repositories/intencion.mongo-repository.js';
import { seedIntenciones } from './intenciones.seeder.js';
import { logger } from '../../../shared/logger.js';

async function runSeeders(): Promise<void> {
  logger.info('[Seeder] Iniciando seeders...');

  await connectMongoDB({
    uri: process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/chatbot_uprit',
    dbName: process.env['MONGODB_DB_NAME'] ?? 'chatbot_uprit',
  });

  const intencionRepo = new IntencionMongoRepository();
  await seedIntenciones(intencionRepo);
  logger.info('[Seeder] ✓ 7 intenciones base sincronizadas');

  await disconnectMongoDB();
  logger.info('[Seeder] Completado.');
}

runSeeders().catch((err: unknown) => {
  logger.error('[Seeder] Error fatal', { error: err });
  process.exit(1);
});
