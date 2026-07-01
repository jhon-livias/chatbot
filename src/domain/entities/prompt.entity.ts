import type { FunnelEtapa } from '../enums/funnel-etapa.enum.js';
import { DomainException } from '../exceptions/domain.exception.js';

/**
 * Expresión regular que detecta al menos una expresión Handlebars en el contenido.
 * Ejemplos válidos: {{variable}}, {{{variable}}}, {{#if x}}...{{/if}}, {{> partial}}
 */
const HBS_EXPRESSION_REGEX = /\{\{.+?\}\}/;

export interface PromptProps {
  id: string;
  /** Etapa del funnel de conversión a la que pertenece este prompt */
  funnel: FunnelEtapa;
  /** ID de la Intencion asociada (ObjectId como string) */
  intencionId: string;
  /**
   * Plantilla Handlebars del prompt.
   * Ejemplo: "Eres un asesor de {{facultad}}. El programa {{nombre}} tiene una duración de {{duracion}}."
   */
  contenido: string;
  /** Descripción interna del propósito del prompt */
  descripcion?: string;
  /**
   * Variables Handlebars esperadas en el contenido.
   * Ej. ["facultad", "nombre", "duracion"]
   */
  variables: string[];
  version: number;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Prompt {
  readonly id: string;
  readonly funnel: FunnelEtapa;
  readonly intencionId: string;
  readonly contenido: string;
  readonly descripcion: string | undefined;
  readonly variables: ReadonlyArray<string>;
  readonly version: number;
  readonly activo: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: PromptProps) {
    this.id = props.id;
    this.funnel = props.funnel;
    this.intencionId = props.intencionId;
    this.contenido = props.contenido;
    this.descripcion = props.descripcion;
    this.variables = props.variables;
    this.version = props.version;
    this.activo = props.activo;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: PromptProps): Prompt {
    if (!props.contenido.trim()) {
      throw new DomainException('El contenido del prompt no puede estar vacío');
    }
    if (!props.intencionId.trim()) {
      throw new DomainException('El prompt debe estar asociado a una intención');
    }
    if (props.version < 1) {
      throw new DomainException('La versión del prompt debe ser mayor o igual a 1');
    }
    return new Prompt(props);
  }

  /** Indica si el contenido incluye al menos una expresión Handlebars */
  usesHandlebars(): boolean {
    return HBS_EXPRESSION_REGEX.test(this.contenido);
  }

  activar(): Prompt {
    return Prompt.create({ ...this.toProps(), activo: true, updatedAt: new Date() });
  }

  desactivar(): Prompt {
    return Prompt.create({ ...this.toProps(), activo: false, updatedAt: new Date() });
  }

  incrementarVersion(): Prompt {
    return Prompt.create({
      ...this.toProps(),
      version: this.version + 1,
      updatedAt: new Date(),
    });
  }

  toProps(): PromptProps {
    return {
      id: this.id,
      funnel: this.funnel,
      intencionId: this.intencionId,
      contenido: this.contenido,
      ...(this.descripcion !== undefined && { descripcion: this.descripcion }),
      variables: [...this.variables],
      version: this.version,
      activo: this.activo,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
