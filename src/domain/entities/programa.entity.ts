import type { TipoPrograma } from '../enums/tipo-programa.enum.js';
import { Modalidad } from '../enums/modalidad.enum.js';
import { DomainException } from '../exceptions/domain.exception.js';

export type ProgramaStatus = 'active' | 'inactive';

export interface ProgramaModalityEntry {
  careerType: string;
  modalities: Modalidad[];
}

export interface ProgramaFaqEntry {
  question: string;
  answer: string;
}

export interface ProgramaCostEntry {
  currency: string;
  thesisFolderFee: number;
  bachelorFolderFee: number;
}

export interface ProgramaProps {
  id: string;
  name: string;
  types: [TipoPrograma, ...TipoPrograma[]];
  facultyId: string;
  duration: string;
  modalities: [ProgramaModalityEntry, ...ProgramaModalityEntry[]];
  academicDegree: string;
  professionalTitle: string;
  brochureUrl: string;
  summary: string;
  sellingPoints: string[];
  tags: string[];
  questionsAnswered: string[];
  faq: ProgramaFaqEntry[];
  graduateProfile: string;
  jobOpportunities: string[];
  objective: string;
  coverImage: string;
  gallery: string[];
  promoVideoUrl: string;
  admissionRequirements: string[];
  /** Número de WhatsApp del coordinador del programa (E.164) */
  whatsappContact: string;
  applicationFormUrl: string;
  thesisFolderFee: number;
  slug: string;
  status: ProgramaStatus;
  directorId: string;
  teacherIds: string[];
  totalCredits: number;
  userId: string;
  searchText: string;
  scheduleDescription: string;
  bachelorFolderFee: number;
  costs: ProgramaCostEntry[];
  /** Contexto extendido usado por el modelo de IA (RAG) */
  iaInformation: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Programa {
  readonly id: string;
  readonly name: string;
  readonly types: ReadonlyArray<TipoPrograma>;
  readonly facultyId: string;
  readonly duration: string;
  readonly modalities: ReadonlyArray<ProgramaModalityEntry>;
  readonly academicDegree: string;
  readonly professionalTitle: string;
  readonly brochureUrl: string;
  readonly summary: string;
  readonly sellingPoints: ReadonlyArray<string>;
  readonly tags: ReadonlyArray<string>;
  readonly questionsAnswered: ReadonlyArray<string>;
  readonly faq: ReadonlyArray<ProgramaFaqEntry>;
  readonly graduateProfile: string;
  readonly jobOpportunities: ReadonlyArray<string>;
  readonly objective: string;
  readonly coverImage: string;
  readonly gallery: ReadonlyArray<string>;
  readonly promoVideoUrl: string;
  readonly admissionRequirements: ReadonlyArray<string>;
  readonly whatsappContact: string;
  readonly applicationFormUrl: string;
  readonly thesisFolderFee: number;
  readonly slug: string;
  readonly status: ProgramaStatus;
  readonly directorId: string;
  readonly teacherIds: ReadonlyArray<string>;
  readonly totalCredits: number;
  readonly userId: string;
  readonly searchText: string;
  readonly scheduleDescription: string;
  readonly bachelorFolderFee: number;
  readonly costs: ReadonlyArray<ProgramaCostEntry>;
  readonly iaInformation: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: ProgramaProps) {
    this.id = props.id;
    this.name = props.name;
    this.types = props.types;
    this.facultyId = props.facultyId;
    this.duration = props.duration;
    this.modalities = props.modalities;
    this.academicDegree = props.academicDegree;
    this.professionalTitle = props.professionalTitle;
    this.brochureUrl = props.brochureUrl;
    this.summary = props.summary;
    this.sellingPoints = props.sellingPoints;
    this.tags = props.tags;
    this.questionsAnswered = props.questionsAnswered;
    this.faq = props.faq;
    this.graduateProfile = props.graduateProfile;
    this.jobOpportunities = props.jobOpportunities;
    this.objective = props.objective;
    this.coverImage = props.coverImage;
    this.gallery = props.gallery;
    this.promoVideoUrl = props.promoVideoUrl;
    this.admissionRequirements = props.admissionRequirements;
    this.whatsappContact = props.whatsappContact;
    this.applicationFormUrl = props.applicationFormUrl;
    this.thesisFolderFee = props.thesisFolderFee;
    this.slug = props.slug;
    this.status = props.status;
    this.directorId = props.directorId;
    this.teacherIds = props.teacherIds;
    this.totalCredits = props.totalCredits;
    this.userId = props.userId;
    this.searchText = props.searchText;
    this.scheduleDescription = props.scheduleDescription;
    this.bachelorFolderFee = props.bachelorFolderFee;
    this.costs = props.costs;
    this.iaInformation = props.iaInformation;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: ProgramaProps): Programa {
    if (!props.name.trim()) {
      throw new DomainException('El nombre del programa no puede estar vacío');
    }
    if (!props.types.length) {
      throw new DomainException('El programa debe tener al menos un tipo');
    }
    if (!props.modalities.length) {
      throw new DomainException('El programa debe tener al menos una modalidad');
    }
    if (!props.iaInformation.trim()) {
      throw new DomainException('El campo iaInformation es requerido para el contexto de IA');
    }
    return new Programa(props);
  }

  isActive(): boolean {
    return this.status === 'active';
  }

  hasType(tipo: TipoPrograma): boolean {
    return (this.types as TipoPrograma[]).includes(tipo);
  }

  isVirtual(): boolean {
    return this.getFlatModalities().includes(Modalidad.VIRTUAL);
  }

  hasModalidad(modalidad: Modalidad): boolean {
    return this.getFlatModalities().includes(modalidad);
  }

  getFlatModalities(): Modalidad[] {
    const unique = new Set<Modalidad>();
    for (const entry of this.modalities) {
      for (const modalidad of entry.modalities) {
        unique.add(modalidad);
      }
    }
    return [...unique];
  }

  update(partial: Partial<Omit<ProgramaProps, 'id' | 'createdAt'>>): Programa {
    return Programa.create({
      ...this.toProps(),
      ...partial,
      updatedAt: new Date(),
    } as ProgramaProps);
  }

  toProps(): ProgramaProps {
    return {
      id: this.id,
      name: this.name,
      types: this.types as [TipoPrograma, ...TipoPrograma[]],
      facultyId: this.facultyId,
      duration: this.duration,
      modalities: this.modalities as [ProgramaModalityEntry, ...ProgramaModalityEntry[]],
      academicDegree: this.academicDegree,
      professionalTitle: this.professionalTitle,
      brochureUrl: this.brochureUrl,
      summary: this.summary,
      sellingPoints: [...this.sellingPoints],
      tags: [...this.tags],
      questionsAnswered: [...this.questionsAnswered],
      faq: [...this.faq],
      graduateProfile: this.graduateProfile,
      jobOpportunities: [...this.jobOpportunities],
      objective: this.objective,
      coverImage: this.coverImage,
      gallery: [...this.gallery],
      promoVideoUrl: this.promoVideoUrl,
      admissionRequirements: [...this.admissionRequirements],
      whatsappContact: this.whatsappContact,
      applicationFormUrl: this.applicationFormUrl,
      thesisFolderFee: this.thesisFolderFee,
      slug: this.slug,
      status: this.status,
      directorId: this.directorId,
      teacherIds: [...this.teacherIds],
      totalCredits: this.totalCredits,
      userId: this.userId,
      searchText: this.searchText,
      scheduleDescription: this.scheduleDescription,
      bachelorFolderFee: this.bachelorFolderFee,
      costs: [...this.costs],
      iaInformation: this.iaInformation,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
