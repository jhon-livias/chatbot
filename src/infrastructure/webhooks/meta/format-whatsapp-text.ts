/**
 * Meta WhatsApp text messages do not support Markdown.
 * Strip common markers so replies render cleanly on mobile.
 */
export function formatWhatsAppText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/gs, '$1')
    .replace(/__(.+?)__/gs, '$1')
    .replace(/\*(.+?)\*/gs, '$1')
    .replace(/_(.+?)_/gs, '$1')
    .replace(/`(.+?)`/gs, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .trim();
}

/** Meta Cloud API expects digits only (country code + number, no +). */
export function toMetaRecipientId(e164: string): string {
  return e164.replace(/\D/g, '');
}
