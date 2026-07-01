import type { ProgramaRepository } from '../../../../domain/repositories/programa.repository.js';
import { Programa, type ProgramaProps } from '../../../../domain/entities/programa.entity.js';
import type { TipoPrograma } from '../../../../domain/enums/tipo-programa.enum.js';
import type { Modalidad } from '../../../../domain/enums/modalidad.enum.js';
import { ProgramaModel, type IProgramaDocument } from '../models/programa.model.js';
import type { FlattenMaps } from 'mongoose';

type LeanPrograma = FlattenMaps<IProgramaDocument>;

export class ProgramaMongoRepository implements ProgramaRepository {
  async findById(id: string): Promise<Programa | null> {
    const doc = await ProgramaModel.findOne({ id }).lean();
    return doc ? this.toDomain(doc as LeanPrograma) : null;
  }

  async findBySlug(slug: string): Promise<Programa | null> {
    const doc = await ProgramaModel.findOne({ slug }).lean();
    return doc ? this.toDomain(doc as LeanPrograma) : null;
  }

  async findAll(): Promise<Programa[]> {
    const docs = await ProgramaModel.find().lean();
    return (docs as LeanPrograma[]).map((d) => this.toDomain(d));
  }

  async findActivos(): Promise<Programa[]> {
    const docs = await ProgramaModel.find({ status: 'active' }).lean();
    return (docs as LeanPrograma[]).map((d) => this.toDomain(d));
  }

  async findByTipo(tipo: TipoPrograma): Promise<Programa[]> {
    const docs = await ProgramaModel.find({ types: tipo, status: 'active' }).lean();
    return (docs as LeanPrograma[]).map((d) => this.toDomain(d));
  }

  async findByModalidad(modalidad: Modalidad): Promise<Programa[]> {
    const docs = await ProgramaModel.find({
      'modalities.modalities': modalidad,
      status: 'active',
    }).lean();
    return (docs as LeanPrograma[]).map((d) => this.toDomain(d));
  }

  async findByFacultyId(facultyId: string): Promise<Programa[]> {
    const docs = await ProgramaModel.find({ facultyId, status: 'active' }).lean();
    return (docs as LeanPrograma[]).map((d) => this.toDomain(d));
  }

  async search(query: string): Promise<Programa[]> {
    const docs = await ProgramaModel.find(
      { $text: { $search: query }, status: 'active' },
      { score: { $meta: 'textScore' } },
    )
      .sort({ score: { $meta: 'textScore' } })
      .lean();
    return (docs as LeanPrograma[]).map((d) => this.toDomain(d));
  }

  async save(programa: Programa): Promise<Programa> {
    const props = programa.toProps();
    await ProgramaModel.findOneAndUpdate({ id: props.id }, this.toPersistence(props), {
      upsert: true,
      new: true,
    });
    return programa;
  }

  async delete(id: string): Promise<void> {
    await ProgramaModel.deleteOne({ id });
  }

  private toPersistence(props: ProgramaProps): Omit<IProgramaDocument, '_id'> {
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

  private toDomain(doc: LeanPrograma): Programa {
    return Programa.create({
      id: doc.id,
      name: doc.name,
      types: doc.types as [TipoPrograma, ...TipoPrograma[]],
      facultyId: doc.facultyId,
      duration: doc.duration,
      modalities: doc.modalities.map((entry) => ({
        careerType: entry.careerType,
        modalities: [...entry.modalities] as Modalidad[],
      })) as ProgramaProps['modalities'],
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
