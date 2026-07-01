import { randomUUID } from 'node:crypto';
import {
  FunnelIntentionType,
  Intencion,
} from '../../../../domain/entities/intencion.entity.js';
import type { IntencionRepository } from '../../../../domain/repositories/intencion.repository.js';

const LOCAL_DEV_USER_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Intenciones base para entorno local.
 * El seeder es idempotente: usa `$setOnInsert` por `type` para no sobreescribir
 * registros existentes si se ejecuta más de una vez.
 *
 * Nota: en producción la fuente de verdad es la colección `funnel_intentions`.
 */
export const INTENCIONES_BASE: Array<Omit<ReturnType<Intencion['toProps']>, 'id'> & { id: string }> = [
  {
    id: randomUUID(),
    userId: LOCAL_DEV_USER_ID,
    title: 'Identificar la Intención del Usuario',
    type: FunnelIntentionType.IDENTIFY_NEED,
    description:
      'La intención por defecto cuando el bot necesita analizar el texto para determinar la verdadera meta del usuario.',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export async function seedIntenciones(repo: IntencionRepository): Promise<void> {
  const intenciones = INTENCIONES_BASE.map((data) => Intencion.create(data));
  await repo.saveBatch(intenciones);
}
