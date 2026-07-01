import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

/**
 * Tokens JWT revocados. TTL index elimina automáticamente documentos
 * cuando el token expira (campo expiresAt en Unix epoch seconds).
 */
export interface ITokenBlacklistDocument {
  _id: Types.ObjectId;
  /** JWT ID (jti claim) */
  jti: string;
  /** Timestamp de expiración en Unix epoch seconds */
  expiresAt: number;
}

export type TokenBlacklistDocument = HydratedDocument<ITokenBlacklistDocument>;

const tokenBlacklistSchema = new Schema<ITokenBlacklistDocument>(
  {
    jti: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Number, required: true },
  },
  {
    versionKey: false,
    collection: 'token_blacklist',
  },
);

export const TokenBlacklistModel = model<ITokenBlacklistDocument>(
  'TokenBlacklist',
  tokenBlacklistSchema,
);
