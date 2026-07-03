import { randomUUID } from 'node:crypto';
import { FunnelUserModel, type IFunnelUserDocument } from '../models/funnel-user.model.js';
import type { FlattenMaps } from 'mongoose';

export type FunnelUserStage =
  | 'AWARENESS'
  | 'CONSIDERATION'
  | 'DECISION'
  | 'HANDOFF'
  | 'CLOSED';

export type UserCategory =
  | 'first_contact'
  | 'interested'
  | 'ready_to_buy'
  | 'not_interested'
  | 'unknown';

export interface FunnelUserData {
  id: string;
  senderId: string;
  name?: string;
  platform: string;
  stage: FunnelUserStage;
  userCategory: UserCategory;
  assignedAgent?: string | null;
  currentFunnelId?: string | null;
  session: Record<string, unknown>;
}

type LeanFunnelUser = FlattenMaps<IFunnelUserDocument>;

const CATEGORY_TO_STAGE: Record<string, FunnelUserStage> = {
  first_contact: 'AWARENESS',
  interested: 'CONSIDERATION',
  ready_to_buy: 'DECISION',
  not_interested: 'CLOSED',
};

/**
 * Persists WhatsApp leads in the funnel_users collection so the admin panel can display them.
 */
export class FunnelUserMongoRepository {
  /** Upsert a funnel user by senderId (phone number). Returns the id. */
  async upsert(params: {
    senderId: string;
    name?: string;
    stage?: FunnelUserStage;
    userCategory?: UserCategory;
    assignedAgent?: string | null;
    sessionPatch?: Record<string, unknown>;
  }): Promise<string> {
    const existing = await FunnelUserModel.findOne({ senderId: params.senderId }).lean();

    if (existing) {
      const update: Partial<LeanFunnelUser> = { updatedAt: new Date() } as Partial<LeanFunnelUser>;
      if (params.name && !existing.name) update.name = params.name;
      if (params.stage) update.stage = params.stage;
      if (params.userCategory) update.userCategory = params.userCategory;
      if (params.assignedAgent !== undefined) update.assignedAgent = params.assignedAgent;

      const sessionUpdate: Record<string, unknown> = {};
      if (params.sessionPatch) {
        for (const [k, v] of Object.entries(params.sessionPatch)) {
          sessionUpdate[`session.${k}`] = v;
        }
      }

      await FunnelUserModel.updateOne(
        { senderId: params.senderId },
        { $set: { ...update, ...sessionUpdate } },
      );
      return existing.id as string;
    }

    const id = randomUUID();
    const stage = params.stage ?? 'AWARENESS';
    const userCategory = params.userCategory ?? 'first_contact';

    await FunnelUserModel.create({
      id,
      senderId: params.senderId,
      name: params.name,
      platform: 'whatsapp',
      showTerms: false,
      stage,
      userCategory,
      campaignId: null,
      adId: null,
      utm_source: null,
      currentFunnelId: null,
      currentAbTestId: null,
      assignedAgent: params.assignedAgent ?? null,
      session: params.sessionPatch ?? {},
    });

    return id;
  }

  /** Update stage/category/agent for an existing funnel user by their UUID id. */
  async updateById(params: {
    id: string;
    stage?: FunnelUserStage;
    userCategory?: UserCategory;
    assignedAgent?: string | null;
  }): Promise<void> {
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (params.stage) update['stage'] = params.stage;
    if (params.userCategory) update['userCategory'] = params.userCategory;
    if (params.assignedAgent !== undefined) update['assignedAgent'] = params.assignedAgent;
    await FunnelUserModel.updateOne({ id: params.id }, { $set: update });
  }

  async findBySenderId(senderId: string): Promise<FunnelUserData | null> {
    const doc = await FunnelUserModel.findOne({ senderId }).lean();
    if (!doc) return null;
    return this.toDomain(doc as LeanFunnelUser);
  }

  async stageFromCategory(purchaseCategory: string): Promise<FunnelUserStage> {
    return CATEGORY_TO_STAGE[purchaseCategory] ?? 'AWARENESS';
  }

  private toDomain(doc: LeanFunnelUser): FunnelUserData {
    return {
      id: doc.id as string,
      senderId: doc.senderId as string,
      name: doc.name as string | undefined,
      platform: doc.platform as string,
      stage: doc.stage as FunnelUserStage,
      userCategory: doc.userCategory as UserCategory,
      assignedAgent: doc.assignedAgent as string | null | undefined,
      currentFunnelId: doc.currentFunnelId as string | null | undefined,
      session: (doc.session ?? {}) as Record<string, unknown>,
    };
  }
}
