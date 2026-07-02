import type { Program } from '../../domain/entities/program.entity.js';

const BASE_INSTRUCTIONS = `Eres el asistente virtual oficial de UPRIT. Responde de manera concisa, amable y profesional en el mismo idioma que el usuario. Usa SOLO texto plano sin markdown (sin **, *, #, ni bloques de codigo) porque el canal es WhatsApp. Si no tienes informacion suficiente para responder, indica amablemente que el equipo de admisiones puede ayudar.`;

const MAX_PROMPT_CHARS = 20_000;

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
      lines.push(truncate(p.iaInformation, 400));
    } else if (p.summary) {
      lines.push(truncate(p.summary, 300));
    }

    if (p.duration) lines.push(`Duración: ${p.duration}`);
    if (p.scheduleDescription) lines.push(truncate(`Horarios: ${p.scheduleDescription}`, 150));

    if (p.admissionRequirements.length > 0) {
      lines.push(`Requisitos: ${p.admissionRequirements.slice(0, 4).join(' | ')}`);
    }

    if (p.applicationFormUrl) lines.push(`Inscripción: ${p.applicationFormUrl}`);
    if (p.whatsappContact) lines.push(`WhatsApp: ${p.whatsappContact}`);

    // Include only the first 3 FAQ entries to keep context short
    const faqSlice = [...p.faq].slice(0, 3);
    if (faqSlice.length > 0) {
      lines.push('FAQ:');
      for (const qa of faqSlice) {
        lines.push(`  P:${truncate(qa.question, 120)} R:${truncate(qa.answer, 200)}`);
      }
    }

    return lines.join('\n');
  }
}
