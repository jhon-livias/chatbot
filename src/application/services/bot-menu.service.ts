import type { OutboundInteractiveListMessage } from '../ports/messaging-provider.port.js';

/** list_reply.id values for the main bot menu (F8). */
export const MENU_ROW_IDS = {
  CAREERS: 'careers',
  ADMISSION: 'admission',
  HANDOFF: 'handoff',
  LOCATION: 'location',
} as const;

export type MenuSelection = (typeof MENU_ROW_IDS)[keyof typeof MENU_ROW_IDS];

/** button_reply.id values for interactive handoff confirmation. */
export const HANDOFF_BUTTON_IDS = {
  YES: 'handoff_yes',
  NO: 'handoff_no',
} as const;

const MENU_KEYWORD_PATTERN = /\b(men[uú]|menu|opciones|ayuda|inicio)\b/i;

/** Bare greetings on first contact — show the interactive menu instead of invoking the LLM. */
const BARE_GREETING_PATTERN =
  /^(?:hola|buen(?:os?|as)\s+(?:d[ií]as|tardes|noches)|hey|hi|hello|saludos)(?:[\s,!?.]+(?:hola|buen(?:os?|as)\s+(?:d[ií]as|tardes|noches)))*[\s,!?.]*$/i;

/** Signals the user already has a concrete question — skip the first-message menu gate. */
const SUBSTANTIVE_QUERY_PATTERN =
  /\?|convalid|costo|admisi[oó]n|carrera|programa|ingenier|derecho|maestr|doctor|bachiller|posgrado|pregrado|matricul|inscrib|requisit|horario|sede|ubicaci|asesor|informaci|egresad|alumno|estudi|facultad|malla|curso|cr[eé]dito|empres|arquitect|industrial|civil|administraci/i;

function isBareGreeting(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (BARE_GREETING_PATTERN.test(trimmed)) return true;
  // Short openers without an actual question (e.g. "Hola Angela") still get the menu.
  return trimmed.length <= 35 && !SUBSTANTIVE_QUERY_PATTERN.test(trimmed);
}

export function isMainMenuTrigger(text: string, isFirstMessage: boolean): boolean {
  const trimmed = text.trim();
  if (MENU_KEYWORD_PATTERN.test(trimmed)) return true;
  if (isFirstMessage) return isBareGreeting(trimmed);
  return false;
}

/** Canonical user phrases passed to the intent router per menu row. */
export const MENU_INTENT_PHRASES: Record<MenuSelection, string> = {
  [MENU_ROW_IDS.CAREERS]: 'Quiero información sobre las carreras disponibles',
  [MENU_ROW_IDS.ADMISSION]: 'Quiero información sobre costos y el proceso de admisión',
  [MENU_ROW_IDS.HANDOFF]: 'Quiero hablar con un asesor',
  [MENU_ROW_IDS.LOCATION]: '¿Dónde está la sede de UPRIT?',
};

export function parseMenuSelection(interactiveReplyId: string | undefined): MenuSelection | null {
  if (!interactiveReplyId) return null;
  const ids = Object.values(MENU_ROW_IDS) as string[];
  return ids.includes(interactiveReplyId) ? (interactiveReplyId as MenuSelection) : null;
}

export function buildMainMenuList(to: string): OutboundInteractiveListMessage {
  return {
    to,
    body: '¡Hola! Soy Angela, asesora de UPRIT. ¿En qué puedo ayudarte hoy?',
    buttonText: 'Ver opciones',
    sections: [
      {
        title: 'Menú principal',
        rows: [
          {
            id: MENU_ROW_IDS.CAREERS,
            title: 'Info carreras',
            description: 'Conoce nuestras carreras y programas',
          },
          {
            id: MENU_ROW_IDS.ADMISSION,
            title: 'Costos y admisión',
            description: 'Proceso, requisitos y costos',
          },
          {
            id: MENU_ROW_IDS.HANDOFF,
            title: 'Hablar con asesor',
            description: 'Atención personalizada',
          },
          {
            id: MENU_ROW_IDS.LOCATION,
            title: 'Ubicación sede',
            description: 'UPRIT Trujillo',
          },
        ],
      },
    ],
  };
}

export function getCampusLocationFromEnv(): {
  latitude: number;
  longitude: number;
  name: string;
  address: string;
} {
  return {
    latitude: Number(process.env['LOCATION_LATITUDE'] ?? -8.1116),
    longitude: Number(process.env['LOCATION_LONGITUDE'] ?? -79.0285),
    name: process.env['LOCATION_NAME'] ?? 'UPRIT - Sede Trujillo',
    address: process.env['LOCATION_ADDRESS'] ?? 'Av. América Sur 2555, Trujillo, La Libertad',
  };
}

export function isInteractiveHandoffEnabled(): boolean {
  return process.env['INTERACTIVE_HANDOFF'] === 'true';
}
