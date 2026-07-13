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

export function isMainMenuTrigger(text: string, _isFirstMessage: boolean): boolean {
  const trimmed = text.trim();
  return MENU_KEYWORD_PATTERN.test(trimmed);
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
