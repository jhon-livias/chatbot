import { DomainException } from '../exceptions/domain.exception.js';

/** Tipos de intención conocidos en la colección funnel_intentions de producción */
export enum FunnelIntentionType {
  IDENTIFY_NEED = 'IDENTIFY_NEED',
}

export interface IntencionProps {
  id: string;
  userId: string;
  title: string;
  /** Tipo estable de la intención, ej. IDENTIFY_NEED */
  type: string;
  description: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Intencion {
  readonly id: string;
  readonly userId: string;
  readonly title: string;
  readonly type: string;
  readonly description: string;
  readonly active: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: IntencionProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.title = props.title;
    this.type = props.type;
    this.description = props.description;
    this.active = props.active;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: IntencionProps): Intencion {
    if (!props.title.trim()) {
      throw new DomainException('El título de la intención no puede estar vacío');
    }
    if (!props.type.trim()) {
      throw new DomainException('El type de la intención no puede estar vacío');
    }
    if (!props.description.trim()) {
      throw new DomainException('La descripción de la intención no puede estar vacía');
    }
    return new Intencion(props);
  }

  activar(): Intencion {
    return Intencion.create({ ...this.toProps(), active: true, updatedAt: new Date() });
  }

  desactivar(): Intencion {
    return Intencion.create({ ...this.toProps(), active: false, updatedAt: new Date() });
  }

  toProps(): IntencionProps {
    return {
      id: this.id,
      userId: this.userId,
      title: this.title,
      type: this.type,
      description: this.description,
      active: this.active,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
