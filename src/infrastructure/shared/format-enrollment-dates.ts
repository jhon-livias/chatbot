import type { EnrollmentPolicySummary } from '../../domain/repositories/enrollment-policy.repository.js';

const ENROLLMENT_DATES_MARKER = 'Fechas de enrolamiento:';

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('es-PE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Lima',
  }).format(new Date(date));
}

export function formatEnrollmentDatesSection(policies: EnrollmentPolicySummary[]): string {
  if (policies.length === 0) return '';

  const lines: string[] = [ENROLLMENT_DATES_MARKER];
  for (const policy of policies) {
    if (policy.dates.length === 0) continue;

    const label = [policy.careerType, policy.period].filter(Boolean).join(' - ');
    if (label) lines.push(`  ${label}:`);

    for (const entry of policy.dates) {
      lines.push(`    - ${entry.type}: ${formatDate(entry.date)}`);
    }
  }

  return lines.length > 1 ? lines.join('\n') : '';
}

export function formatEnrollmentDatesFromPolicy(policy: EnrollmentPolicySummary | null): string {
  if (!policy || policy.dates.length === 0) return '';
  return formatEnrollmentDatesSection([policy]);
}

export function formatEnrollmentDatesForTool(policy: EnrollmentPolicySummary | null): Array<{ tipo: string; fecha: string }> {
  if (!policy || policy.dates.length === 0) return [];
  return policy.dates.map((entry) => ({
    tipo: entry.type,
    fecha: formatDate(entry.date),
  }));
}

export function appendEnrollmentDates(
  baseContent: string,
  policies: EnrollmentPolicySummary[],
): string {
  const section = formatEnrollmentDatesSection(policies);
  if (!section) return baseContent;
  if (baseContent.includes(ENROLLMENT_DATES_MARKER)) return baseContent;
  return `${baseContent.trimEnd()}\n${section}`;
}

export function appendEnrollmentDateFromPolicy(
  baseContent: string,
  policy: EnrollmentPolicySummary | null,
): string {
  if (!policy) return baseContent;
  return appendEnrollmentDates(baseContent, [policy]);
}
