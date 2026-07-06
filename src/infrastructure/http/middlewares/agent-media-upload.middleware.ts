import multer from 'multer';
import type { MessageContentType } from '../../../domain/entities/message.entity.js';

/** Meta limits: images 5 MB, audio 16 MB, video 16 MB, docs 100 MB. */
export const AGENT_MEDIA_MAX_BYTES = 16 * 1024 * 1024; // 16 MB (covers audio & video)

export const ALLOWED_AGENT_MEDIA_MIMES = new Set([
  // Image
  'image/jpeg',
  'image/png',
  'image/webp',
  // Document
  'application/pdf',
  // Audio (A4)
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/amr',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  // Video (A5)
  'video/mp4',
  'video/3gpp',
]);

export const agentMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: AGENT_MEDIA_MAX_BYTES },
});

export function mimeToAgentContentType(mimeType: string): MessageContentType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  return 'document';
}

export function mimeToMetaMediaType(
  mimeType: string,
): 'image' | 'document' | 'audio' | 'video' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  return 'document';
}

export function validateAgentMediaMime(mimeType: string): void {
  if (!ALLOWED_AGENT_MEDIA_MIMES.has(mimeType)) {
    throw new Error(
      `Tipo de archivo no permitido: ${mimeType}. ` +
        `Permitidos: imágenes (jpeg/png/webp), PDF, audio (ogg/mp3/mp4/aac/amr/wav/webm), video (mp4/3gpp)`,
    );
  }
}
