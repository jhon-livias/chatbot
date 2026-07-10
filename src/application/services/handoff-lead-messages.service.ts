import type { Agent } from '../../domain/entities/agent.entity.js';

const DEFAULT_ASSIGNED_MSG =
  '¡Listo! Te asigné a {agentName}, asesor/a de admisiones de la UPRIT. En un momento continúa contigo por este chat.\n\n' +
  'Si necesitas contactarle directamente: {agentWhatsapp}\n\n' +
  'Horario de atención: lunes a viernes, 8:00 a.m. a 5:00 p.m.';

const DEFAULT_PENDING_MSG =
  'Perfecto, te estoy derivando con nuestro equipo de admisiones. Un asesor te contactará en breve por este mismo chat.\n\n' +
  'Horario de atención: lunes a viernes, 8:00 a.m. a 5:00 p.m.';

/** Formats E.164 for display in Peru (e.g. +51915974331 → +51 915 974 331). */
export function formatAgentWhatsappForDisplay(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  if (digits.startsWith('51') && digits.length === 11) {
    return `+51 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return e164.startsWith('+') ? e164 : `+${digits}`;
}

export function buildHandoffAssignedLeadMessage(agent: Agent): string {
  const template = process.env['HANDOFF_TRANSITION_MESSAGE'] ?? DEFAULT_ASSIGNED_MSG;
  const firstName = agent.name.trim().split(/\s+/)[0] ?? agent.name;
  return template
    .replaceAll('{agentName}', agent.name)
    .replaceAll('{agentFirstName}', firstName)
    .replaceAll('{agentWhatsapp}', formatAgentWhatsappForDisplay(agent.whatsapp));
}

export function buildHandoffPendingLeadMessage(): string {
  return process.env['HANDOFF_PENDING_MESSAGE'] ?? DEFAULT_PENDING_MSG;
}
