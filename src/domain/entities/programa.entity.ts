import type { TipoPrograma } from '../enums/tipo-programa.enum.js';
import { Modalidad } from '../enums/modalidad.enum.js';
import { DomainException } from '../exceptions/domain.exception.js';

export interface ProgramaProps {
  id: string;
  nombre: string;
  facultad: string;
  tipo: TipoPrograma;
  /** Al menos una modalidad debe estar presente */
  modalidades: [Modalidad, ...Modalidad[]];
  /** Duración en formato legible, ej. "8 semestres", "2 años" */
  duracion: string;
  /** Título otorgado, ej. "Ingeniero de Sistemas y Computación" */
  titulo: string;
  /** Número de WhatsApp del coordinador del programa (E.164) */
  whatsapp: string;
  /** Resumen corto para mostrar al usuario (~200 caracteres) */
  resumen: string;
  /**
   * Descripción extendida usada por el modelo de IA para contextualizar
   * respuestas (RAG). Incluye pensum, perfil del egresado, campo laboral, etc.
   */
  detalle_para_ia: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Programa {
  readonly id: string;
  readonly nombre: string;
  readonly facultad: string;
  readonly tipo: TipoPrograma;
  readonly modalidades: ReadonlyArray<Modalidad>;
  readonly duracion: string;
  readonly titulo: string;
  readonly whatsapp: string;
  readonly resumen: string;
  readonly detalle_para_ia: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: ProgramaProps) {
    this.id = props.id;
    this.nombre = props.nombre;
    this.facultad = props.facultad;
    this.tipo = props.tipo;
    this.modalidades = props.modalidades;
    this.duracion = props.duracion;
    this.titulo = props.titulo;
    this.whatsapp = props.whatsapp;
    this.resumen = props.resumen;
    this.detalle_para_ia = props.detalle_para_ia;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: ProgramaProps): Programa {
    if (!props.nombre.trim()) {
      throw new DomainException('El nombre del programa no puede estar vacío');
    }
    if (!props.modalidades.length) {
      throw new DomainException('El programa debe tener al menos una modalidad');
    }
    if (!props.detalle_para_ia.trim()) {
      throw new DomainException('El campo detalle_para_ia es requerido para el contexto de IA');
    }
    return new Programa(props);
  }

  isVirtual(): boolean {
    return (this.modalidades as Modalidad[]).includes(Modalidad.VIRTUAL);
  }

  hasModalidad(modalidad: Modalidad): boolean {
    return (this.modalidades as Modalidad[]).includes(modalidad);
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
      nombre: this.nombre,
      facultad: this.facultad,
      tipo: this.tipo,
      modalidades: this.modalidades as [Modalidad, ...Modalidad[]],
      duracion: this.duracion,
      titulo: this.titulo,
      whatsapp: this.whatsapp,
      resumen: this.resumen,
      detalle_para_ia: this.detalle_para_ia,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
