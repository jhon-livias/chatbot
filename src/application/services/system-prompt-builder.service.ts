import type { Program } from '../../domain/entities/program.entity.js';

const BASE_INSTRUCTIONS = `Eres el asistente virtual oficial de UPRIT. Responde de manera concisa, amable y profesional en el mismo idioma que el usuario. Usa SOLO texto plano sin markdown (sin **, *, #, ni bloques de codigo) porque el canal es WhatsApp. Si no tienes informacion suficiente para responder, indica amablemente que el equipo de admisiones puede ayudar.`;

/**
 * Builds the AI system prompt by injecting institution and program data from MongoDB.
 * Call build() once per new conversation and store the result in conversation.systemPrompt.
 */
export class SystemPromptBuilderService {
  build(programs: Program[]): string {
    if (programs.length === 0) {
      return BASE_INSTRUCTIONS;
    }

    const programBlocks = programs.map((p) => this.formatProgram(p)).join('\n\n---\n\n');

    return `${BASE_INSTRUCTIONS}

== PROGRAMAS ACADEMICOS DE UPRIT ==

${programBlocks}`;
  }

  private formatProgram(p: Program): string {
    const lines: string[] = [`PROGRAMA: ${p.name}`];

    if (p.iaInformation) lines.push(`Info IA: ${p.iaInformation}`);
    if (p.summary) lines.push(`Resumen: ${p.summary}`);
    if (p.duration) lines.push(`Duracion: ${p.duration}`);
    if (p.academicDegree) lines.push(`Grado academico: ${p.academicDegree}`);
    if (p.professionalTitle) lines.push(`Titulo profesional: ${p.professionalTitle}`);
    if (p.scheduleDescription) lines.push(`Horarios: ${p.scheduleDescription}`);
    if (p.objective) lines.push(`Objetivo: ${p.objective}`);
    if (p.graduateProfile) lines.push(`Perfil del egresado: ${p.graduateProfile}`);

    if (p.sellingPoints.length > 0) {
      lines.push(`Ventajas: ${p.sellingPoints.join('. ')}`);
    }

    if (p.jobOpportunities.length > 0) {
      lines.push(`Campo laboral: ${p.jobOpportunities.join(', ')}`);
    }

    if (p.admissionRequirements.length > 0) {
      lines.push(`Requisitos de admision: ${p.admissionRequirements.join(' | ')}`);
    }

    const activeCosts = p.costs.filter((c) => c.bachelorFolderFee > 0 || c.thesisFolderFee > 0);
    if (activeCosts.length > 0) {
      const costStr = activeCosts
        .map(
          (c) =>
            `${c.currency}: carpeta bachiller ${c.bachelorFolderFee}, carpeta tesis ${c.thesisFolderFee}`,
        )
        .join(' | ');
      lines.push(`Costos: ${costStr}`);
    }

    if (p.applicationFormUrl) lines.push(`Formulario de inscripcion: ${p.applicationFormUrl}`);
    if (p.whatsappContact) lines.push(`WhatsApp admisiones: ${p.whatsappContact}`);
    if (p.brochureUrl) lines.push(`Brochure: ${p.brochureUrl}`);

    if (p.faq.length > 0) {
      lines.push('Preguntas frecuentes:');
      for (const qa of p.faq) {
        lines.push(`  P: ${qa.question}`);
        lines.push(`  R: ${qa.answer}`);
      }
    }

    return lines.join('\n');
  }
}
