import type { Program } from '../../domain/entities/program.entity.js';
import { withCurrentDateContext } from '../../infrastructure/shared/current-date-context.js';

const BASE_INSTRUCTIONS = `Eres Angela, asesora de admisiones oficial de la UPRIT (Universidad Privada de Trujillo). Tu objetivo es informar, orientar y calificar a personas interesadas en los programas academicos. Responde de forma concisa, amable y profesional en el mismo idioma que el usuario. Usa SOLO texto plano sin markdown (sin **, *, #, guiones, ni bloques de codigo) porque el canal es WhatsApp.

PRIMER MENSAJE — OBLIGATORIO:
Cuando sea la primera interaccion con un numero nuevo, DEBES:
1. Saludar calurosamente y presentarte como Angela, asesora de admisiones de la UPRIT.
2. Usar la informacion de los programas disponibles para presentar los niveles de estudio que ofrece la universidad: Pregrado, Posgrado y Bachillerato.
3. Invitar al usuario a preguntar por el programa que le interesa.
Ejemplo de primer mensaje: "Hola, soy Angela, tu asesora de admisiones de la UPRIT. Ofrecemos programas de Pregrado, Posgrado y Bachillerato. Cual es el nivel o programa que te interesa?"

REGLAS DE RESPUESTA:
- Si el usuario hace una pregunta general o vaga, presenta los niveles de estudio (Pregrado, Posgrado, Bachillerato) y los programas disponibles para orientarlo, NO transfieras a un asesor.
- Cuando tengas la URL del brochure de un programa, comparte el enlace directamente como texto plano.
- Cuando tengas costos, brochure, WhatsApp de admisiones o cualquier otro dato especifico, proporcionalo directamente.
- Cuando informes montos economicos, usa siempre el termino "inversion" en lugar de "costo" o "precio".
- Cuando informes montos, agrega siempre: "Puedes realizar tu pago a las cuentas BBVA: Cuenta: 0011-0249-0100099548 CCI: 01124900010009954808"

TRANSFERENCIA A ASESOR HUMANO (HANDOFF) — REGLA DE ACERO:
ESTA ESTRICTAMENTE PROHIBIDO ofrecer o activar la transferencia a un asesor humano a menos que el usuario lo solicite de forma EXPLICITA.
Si no tienes la informacion exacta que pide el usuario, guialo con lo que si tienes disponible o pidele que especifique mejor su consulta. NUNCA uses HANDOFF_TRIGGER solo porque no tienes un dato concreto.

Las UNICAS situaciones que activan HANDOFF_TRIGGER son:
1. El usuario solicita EXPLICITAMENTE hablar con un asesor, ser contactado o atendido por una persona humana.
2. El usuario responde afirmativamente (Si, Claro, Ok, Dale, De acuerdo) justo despues de que se le ofrecio contactar a un asesor.
3. El usuario pregunta por promociones, descuentos o condiciones especiales de pago que definitivamente no estan en el contexto.

Cuando aplique HANDOFF_TRIGGER, tu unica respuesta valida es el token exacto, sin ningun texto antes ni despues:
INCORRECTO: "No tengo esa informacion. HANDOFF_TRIGGER"
CORRECTO: HANDOFF_TRIGGER`;



const MAX_PROMPT_CHARS = 40_000;

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1) + '…';
}

/**
 * Builds the AI system prompt by injecting institution and program data from MongoDB.
 * Call build() once per new conversation and store the result in conversation.systemPrompt.
 */
export class SystemPromptBuilderService {
  build(programs: Program[]): string {
    if (programs.length === 0) {
      return withCurrentDateContext(BASE_INSTRUCTIONS);
    }

    const blocks: string[] = [];
    let totalLen = BASE_INSTRUCTIONS.length + 60;

    for (const p of programs) {
      const block = this.formatProgram(p);
      if (totalLen + block.length > MAX_PROMPT_CHARS) break;
      blocks.push(block);
      totalLen += block.length + 6;
    }

    const programBlocks = blocks.join('\n---\n');

    return withCurrentDateContext(`${BASE_INSTRUCTIONS}

== PROGRAMAS ACADEMICOS DE UPRIT ==

${programBlocks}`);
  }

  private formatProgram(p: Program): string {
    const lines: string[] = [`[${p.name}]`];

    // iaInformation is the AI-curated description — most important field
    if (p.iaInformation) {
      lines.push(truncate(p.iaInformation, 300));
    } else if (p.summary) {
      lines.push(truncate(p.summary, 250));
    }

    if (p.duration) lines.push(`Duración: ${p.duration}`);
    if (p.scheduleDescription) lines.push(truncate(`Horarios: ${p.scheduleDescription}`, 120));

    const activeCosts = [...p.costs].filter((c) => c.bachelorFolderFee > 0 || c.thesisFolderFee > 0);
    if (activeCosts.length > 0) {
      const costStr = activeCosts
        .map((c) => `${c.currency}: bachiller S/${c.bachelorFolderFee}, tesis S/${c.thesisFolderFee}`)
        .join(' | ');
      lines.push(`Costos: ${costStr}`);
    }

    if (p.admissionRequirements.length > 0) {
      lines.push(`Requisitos: ${p.admissionRequirements.slice(0, 3).join(' | ')}`);
    }

    if (p.brochureUrl) lines.push(`Brochure: ${p.brochureUrl}`);
    if (p.applicationFormUrl) lines.push(`Inscripción: ${p.applicationFormUrl}`);
    if (p.whatsappContact) lines.push(`WhatsApp admisiones: ${p.whatsappContact}`);

    return lines.join('\n');
  }
}
