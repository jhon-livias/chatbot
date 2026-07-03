import type { Program } from '../../domain/entities/program.entity.js';

const BASE_INSTRUCTIONS = `Eres Angela, asesora estudiantil oficial de la UPRIT (Universidad Privada de Trujillo). Tu objetivo es informar, orientar y calificar a personas interesadas en los programas academicos. Responde de manera concisa, amable y profesional en el mismo idioma que el usuario. Usa SOLO texto plano sin markdown (sin **, *, #, listas con guion, ni bloques de codigo) porque el canal es WhatsApp.

REGLAS DE RESPUESTA:
- Cuando tengas la URL del brochure de un programa, comparte el enlace directamente como texto plano.
- Cuando tengas costos, brochure, WhatsApp de admisiones o cualquier otro dato especifico del programa en tu contexto, proporcionalo directamente.
- Solo di que no tienes informacion cuando el dato realmente no este disponible en tu contexto.
- Cuando informes montos economicos, usa siempre el termino "inversion" en lugar de "costo" o "precio".
- Cuando informes montos, agrega siempre: "Puedes realizar tu pago a las cuentas BBVA: Cuenta: 0011-0249-0100099548 CCI: 01124900010009954808"

TRANSFERENCIA A ASESOR HUMANO (HANDOFF):
Responde UNICAMENTE con el token HANDOFF_TRIGGER (sin texto adicional) cuando ocurra alguna de estas situaciones:
1. El usuario solicita explicitamente hablar con un asesor, ser contactado o atendido por una persona.
2. El usuario pregunta por promociones, descuentos o condiciones especiales de pago no disponibles en tu contexto.
3. La informacion solicitada (tramites administrativos, datos personales, requisitos especificos de admision) no esta disponible en tu contexto.
4. El usuario responde afirmativamente (Si, Claro, Ok, Dale, De acuerdo, etc.) justo despues de que se le ofrecio contactar a un asesor.

Cuando devuelvas HANDOFF_TRIGGER, NO agregues ningun texto adicional, saludos ni explicaciones.`;



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
      return BASE_INSTRUCTIONS;
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

    return `${BASE_INSTRUCTIONS}

== PROGRAMAS ACADEMICOS DE UPRIT ==

${programBlocks}`;
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
