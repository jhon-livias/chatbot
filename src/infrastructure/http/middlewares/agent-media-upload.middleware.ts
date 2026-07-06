import multer from 'multer';
import type { MessageContentType } from '../../../domain/entities/message.entity.js';

/** Max upload size for agent outbound media (10 MB). */
export const AGENT_MEDIA_MAX_BYTES = 10 * 1024 * 1024;

export const ALLOWED_AGENT_MEDIA_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

export const agentMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: AGENT_MEDIA_MAX_BYTES },
});

export function mimeToAgentContentType(mimeType: string): MessageContentType {
  return mimeType.startsWith('image/') ? 'image' : 'document';
}

export function validateAgentMediaMime(mimeType: string): void {
  if (!ALLOWED_AGENT_MEDIA_MIMES.has(mimeType)) {
    throw new Error(
      `Tipo de archivo no permitido: ${mimeType}. Permitidos: image/jpeg, image/png, image/webp, application/pdf`,
    );
  }
}
