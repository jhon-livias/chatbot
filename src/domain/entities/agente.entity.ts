import { DomainException } from '../exceptions/domain.exception.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_REGEX = /^\+[1-9]\d{7,14}$/;

export type AgenteStatus = 'Active' | 'Inactive';

export interface AgenteProps {
  id: string;
  name: string;
  email: string;
  /** Número en formato E.164 para notificaciones de handoff vía WhatsApp */
  whatsapp: string;
  status: AgenteStatus;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Agente {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly whatsapp: string;
  readonly status: AgenteStatus;
  readonly userId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: AgenteProps) {
    this.id = props.id;
    this.name = props.name;
    this.email = props.email;
    this.whatsapp = props.whatsapp;
    this.status = props.status;
    this.userId = props.userId;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  get activo(): boolean {
    return this.status === 'Active';
  }

  static create(props: AgenteProps): Agente {
    if (!props.name.trim()) {
      throw new DomainException('El nombre del agente no puede estar vacío');
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
    return Agente.create({ ...this.toProps(), status: 'Inactive', updatedAt: new Date() });
  }

  activar(): Agente {
    return Agente.create({ ...this.toProps(), status: 'Active', updatedAt: new Date() });
  }

  toProps(): AgenteProps {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      whatsapp: this.whatsapp,
      status: this.status,
      userId: this.userId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
