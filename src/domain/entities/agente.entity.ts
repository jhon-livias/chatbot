import { DomainException } from '../exceptions/domain.exception.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_REGEX = /^\+[1-9]\d{7,14}$/;

export interface AgenteProps {
  id: string;
  nombre_completo: string;
  ubicacion: string;
  descripcion: string;
  email: string;
  /** Número en formato E.164 para notificaciones de handoff vía WhatsApp */
  whatsapp: string;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Agente {
  readonly id: string;
  readonly nombre_completo: string;
  readonly ubicacion: string;
  readonly descripcion: string;
  readonly email: string;
  readonly whatsapp: string;
  readonly activo: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: AgenteProps) {
    this.id = props.id;
    this.nombre_completo = props.nombre_completo;
    this.ubicacion = props.ubicacion;
    this.descripcion = props.descripcion;
    this.email = props.email;
    this.whatsapp = props.whatsapp;
    this.activo = props.activo;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: AgenteProps): Agente {
    if (!props.nombre_completo.trim()) {
      throw new DomainException('El nombre completo del agente no puede estar vacío');
    }
    if (!EMAIL_REGEX.test(props.email)) {
      throw new DomainException(`Email inválido: "${props.email}"`);
    }
    if (!E164_REGEX.test(props.whatsapp)) {
      throw new DomainException(
        `WhatsApp del agente inválido: "${props.whatsapp}". Debe estar en formato E.164`,
      );
    }
    return new Agente(props);
  }

  desactivar(): Agente {
    return Agente.create({ ...this.toProps(), activo: false, updatedAt: new Date() });
  }

  activar(): Agente {
    return Agente.create({ ...this.toProps(), activo: true, updatedAt: new Date() });
  }

  toProps(): AgenteProps {
    return {
      id: this.id,
      nombre_completo: this.nombre_completo,
      ubicacion: this.ubicacion,
      descripcion: this.descripcion,
      email: this.email,
      whatsapp: this.whatsapp,
      activo: this.activo,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
