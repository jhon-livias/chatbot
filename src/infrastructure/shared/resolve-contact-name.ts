import type { UserRepository } from '../../domain/repositories/user.repository.js';
import type { FunnelUserMongoRepository } from '../database/mongodb/repositories/funnel-user.mongo-repository.js';

/** Resolve lead display name from funnel_users (WhatsApp profile) or users collection. */
export async function resolveContactName(
  phoneNumber: string,
  userId: string | undefined,
  funnelUserRepo: FunnelUserMongoRepository,
  userRepo: UserRepository,
): Promise<string | null> {
  const funnelUser = await funnelUserRepo.findBySenderId(phoneNumber);
  const funnelName = funnelUser?.name?.trim();
  if (funnelName) return funnelName;

  if (userId) {
    const names = await userRepo.findNamesByIds([userId]);
    const userName = names.get(userId)?.trim();
    if (userName) return userName;
  }

  return null;
}
