import type {
  ContextSourceDataRepository,
  ContextSourceData,
} from '../../../../domain/repositories/context-source-data.repository.js';
import { ContextSourceDataModel } from '../models/context-source-data.model.js';
import { ProgramModel } from '../models/program.model.js';

export class ContextSourceDataMongoRepository implements ContextSourceDataRepository {
  async findByProgramId(programId: string): Promise<ContextSourceData | null> {
    const doc = await ContextSourceDataModel.findOne({ original_id: programId }).lean();
    if (doc) {
      return { originalId: doc.original_id, fullTextContent: doc.full_text_content, programName: doc.program_name };
    }
    // Fallback: build text content from the program document itself
    return this.buildFromProgram(programId);
  }

  async findByProgramName(name: string): Promise<ContextSourceData | null> {
    const doc = await ContextSourceDataModel.findOne({
      program_name: { $regex: new RegExp(name.trim(), 'i') },
    }).lean();
    if (doc) {
      return { originalId: doc.original_id, fullTextContent: doc.full_text_content, programName: doc.program_name };
    }
    // Fallback: search program by name and build content
    const prog = await ProgramModel.findOne({
      name: { $regex: new RegExp(name.trim(), 'i') },
      status: 'active',
    }).lean();
    if (!prog) return null;
    return { originalId: prog.id, fullTextContent: this.buildProgramText(prog), programName: prog.name };
  }

  async searchByText(query: string, limit = 5): Promise<ContextSourceData[]> {
    if (!query.trim()) return [];

    // Try MongoDB text search first
    try {
      const docs = await ContextSourceDataModel
        .find({ $text: { $search: query } }, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        .limit(limit)
        .lean();

      if (docs.length > 0) {
        return docs.map((d) => ({
          originalId: d.original_id,
          fullTextContent: d.full_text_content,
          programName: d.program_name,
        }));
      }
    } catch {
      // Text index might not exist; fall through to regex search
    }

    // Fallback: regex search on programs
    const terms = query.split(/\s+/).filter(Boolean).slice(0, 5);
    const regexes = terms.map((t) => new RegExp(t, 'i'));
    const progs = await ProgramModel.find({
      status: 'active',
      $or: [
        { name: { $in: regexes } },
        { summary: { $in: regexes } },
        { iaInformation: { $in: regexes } },
      ],
    })
      .limit(limit)
      .lean();

    return progs.map((p) => ({
      originalId: p.id,
      fullTextContent: this.buildProgramText(p),
      programName: p.name,
    }));
  }

  private async buildFromProgram(programId: string): Promise<ContextSourceData | null> {
    const prog = await ProgramModel.findOne({ id: programId }).lean();
    if (!prog) return null;
    return { originalId: prog.id, fullTextContent: this.buildProgramText(prog), programName: prog.name };
  }

  private buildProgramText(prog: Record<string, unknown>): string {
    const lines: string[] = [];
    if (prog['name']) lines.push(`Nombre: ${prog['name']}`);
    if (prog['summary']) lines.push(`Resumen: ${prog['summary']}`);
    if (prog['iaInformation']) lines.push(`Detalle IA: ${prog['iaInformation']}`);
    if (prog['duration']) lines.push(`Duración: ${prog['duration']}`);
    if (prog['scheduleDescription']) lines.push(`Horarios: ${prog['scheduleDescription']}`);
    if (prog['graduateProfile']) lines.push(`Perfil del egresado: ${prog['graduateProfile']}`);
    if (prog['objective']) lines.push(`Objetivos: ${prog['objective']}`);
    if (prog['admissionRequirements'] && Array.isArray(prog['admissionRequirements'])) {
      lines.push(`Requisitos: ${(prog['admissionRequirements'] as string[]).join(', ')}`);
    }
    if (prog['whatsappContact']) lines.push(`WhatsApp admisiones: ${prog['whatsappContact']}`);
    if (prog['brochureUrl']) lines.push(`Brochure: ${prog['brochureUrl']}`);
    if (prog['applicationFormUrl']) lines.push(`Inscripción: ${prog['applicationFormUrl']}`);
    const costs = prog['costs'] as Array<Record<string, unknown>> | undefined;
    if (costs && costs.length > 0) {
      const costStr = costs
        .map((c) => `${c['currency']}: bachiller S/${c['bachelorFolderFee']}, tesis S/${c['thesisFolderFee']}`)
        .join(' | ');
      lines.push(`Inversión: ${costStr}`);
    }
    return lines.join('\n');
  }
}
