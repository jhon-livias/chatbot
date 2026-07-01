import type { IntencionCodigo } from '../enums/intencion-codigo.enum.js';
import { DomainException } from '../exceptions/domain.exception.js';

export interface IntencionProps {
  id: string;
  /** Slug único y estable — ver IntencionCodigo */
  codigo: IntencionCodigo;
  titulo: string;
  descripcion: string;
}

export class Intencion {
  readonly id: string;
  readonly codigo: IntencionCodigo;
  readonly titulo: string;
  readonly descripcion: string;

  private constructor(props: IntencionProps) {
    this.id = props.id;
    this.codigo = props.codigo;
    this.titulo = props.titulo;
    this.descripcion = props.descripcion;
  }

  static create(props: IntencionProps): Intencion {
    if (!props.titulo.trim()) {
      throw new DomainException('El título de la intención no puede estar vacío');
    }
    if (!props.descripcion.trim()) {
      throw new DomainException('La descripción de la intención no puede estar vacía');
    }
    return new Intencion(props);
  }

  toProps(): IntencionProps {
    return {
      id: this.id,
      codigo: this.codigo,
      titulo: this.titulo,
      descripcion: this.descripcion,
    };
  }
}
