import type { ProgramRepository } from '../../../../domain/repositories/program.repository.js';
import { Program, type ProgramProps } from '../../../../domain/entities/program.entity.js';
import type { ProgramType } from '../../../../domain/enums/program-type.enum.js';
import type { Modality } from '../../../../domain/enums/modality.enum.js';
import { ProgramModel, type IProgramDocument } from '../models/program.model.js';
import type { FlattenMaps } from 'mongoose';

type LeanProgram = FlattenMaps<IProgramDocument>;

export class ProgramMongoRepository implements ProgramRepository {
  async findById(id: string): Promise<Program | null> {
    const doc = await ProgramModel.findOne({ id }).lean();
    return doc ? this.toDomain(doc as LeanProgram) : null;
  }

  async findBySlug(slug: string): Promise<Program | null> {
    const doc = await ProgramModel.findOne({ slug }).lean();
    return doc ? this.toDomain(doc as LeanProgram) : null;
  }

  async findAll(): Promise<Program[]> {
    const docs = await ProgramModel.find().lean();
    return (docs as LeanProgram[]).map((d) => this.toDomain(d));
  }

  async findActive(): Promise<Program[]> {
    const docs = await ProgramModel.find({ status: 'active' }).lean();
    return (docs as LeanProgram[]).map((d) => this.toDomain(d));
  }

  async findByType(type: ProgramType): Promise<Program[]> {
    const docs = await ProgramModel.find({ types: type, status: 'active' }).lean();
    return (docs as LeanProgram[]).map((d) => this.toDomain(d));
  }

  async findByModality(modality: Modality): Promise<Program[]> {
    const docs = await ProgramModel.find({
      'modalities.modalities': modality,
      status: 'active',
    }).lean();
    return (docs as LeanProgram[]).map((d) => this.toDomain(d));
  }

  async findByFacultyId(facultyId: string): Promise<Program[]> {
    const docs = await ProgramModel.find({ facultyId, status: 'active' }).lean();
    return (docs as LeanProgram[]).map((d) => this.toDomain(d));
  }

  async search(query: string): Promise<Program[]> {
    const docs = await ProgramModel.find(
      { $text: { $search: query }, status: 'active' },
      { score: { $meta: 'textScore' } },
    )
      .sort({ score: { $meta: 'textScore' } })
      .lean();
    return (docs as LeanProgram[]).map((d) => this.toDomain(d));
  }

  async save(program: Program): Promise<Program> {
    const props = program.toProps();
    await ProgramModel.findOneAndUpdate({ id: props.id }, this.toPersistence(props), {
      upsert: true,
      new: true,
    });
    return program;
  }

  async delete(id: string): Promise<void> {
    await ProgramModel.deleteOne({ id });
  }

  private toPersistence(props: ProgramProps): Omit<IProgramDocument, '_id'> {
    return {
      id: props.id,
      name: props.name,
      types: props.types,
      facultyId: props.facultyId,
      duration: props.duration,
      modalities: props.modalities.map((entry) => ({
        careerType: entry.careerType,
        modalities: [...entry.modalities],
      })),
      academicDegree: props.academicDegree,
      professionalTitle: props.professionalTitle,
      brochureUrl: props.brochureUrl,
      summary: props.summary,
      sellingPoints: [...props.sellingPoints],
      tags: [...props.tags],
      questionsAnswered: [...props.questionsAnswered],
      faq: props.faq.map((item) => ({ ...item })),
      graduateProfile: props.graduateProfile,
      jobOpportunities: [...props.jobOpportunities],
      objective: props.objective,
      coverImage: props.coverImage,
      gallery: [...props.gallery],
      promoVideoUrl: props.promoVideoUrl,
      admissionRequirements: [...props.admissionRequirements],
      whatsappContact: props.whatsappContact,
      applicationFormUrl: props.applicationFormUrl,
      thesisFolderFee: props.thesisFolderFee,
      slug: props.slug,
      status: props.status,
      directorId: props.directorId,
      teacherIds: [...props.teacherIds],
      totalCredits: props.totalCredits,
      userId: props.userId,
      searchText: props.searchText,
      scheduleDescription: props.scheduleDescription,
      bachelorFolderFee: props.bachelorFolderFee,
      costs: props.costs.map((item) => ({ ...item })),
      iaInformation: props.iaInformation,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    };
  }

  private toDomain(doc: LeanProgram): Program {
    return Program.create({
      id: doc.id,
      name: doc.name,
      types: doc.types as [ProgramType, ...ProgramType[]],
      facultyId: doc.facultyId,
      duration: doc.duration,
      modalities: doc.modalities.map((entry) => ({
        careerType: entry.careerType,
        modalities: [...entry.modalities] as Modality[],
      })) as ProgramProps['modalities'],
      academicDegree: doc.academicDegree,
      professionalTitle: doc.professionalTitle,
      brochureUrl: doc.brochureUrl,
      summary: doc.summary,
      sellingPoints: [...doc.sellingPoints],
      tags: [...doc.tags],
      questionsAnswered: [...doc.questionsAnswered],
      faq: doc.faq.map((item) => ({ ...item })),
      graduateProfile: doc.graduateProfile,
      jobOpportunities: [...doc.jobOpportunities],
      objective: doc.objective,
      coverImage: doc.coverImage,
      gallery: [...doc.gallery],
      promoVideoUrl: doc.promoVideoUrl,
      admissionRequirements: [...doc.admissionRequirements],
      whatsappContact: doc.whatsappContact,
      applicationFormUrl: doc.applicationFormUrl,
      thesisFolderFee: doc.thesisFolderFee,
      slug: doc.slug,
      status: doc.status,
      directorId: doc.directorId,
      teacherIds: [...doc.teacherIds],
      totalCredits: doc.totalCredits,
      userId: doc.userId,
      searchText: doc.searchText,
      scheduleDescription: doc.scheduleDescription,
      bachelorFolderFee: doc.bachelorFolderFee,
      costs: doc.costs.map((item) => ({ ...item })),
      iaInformation: doc.iaInformation,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  }
}
