import type { Intencion } from '../entities/intencion.entity.js';
import type { IntencionCodigo } from '../enums/intencion-codigo.enum.js';

export interface IntencionRepository {
  findById(id: string): Promise<Intencion | null>;
  findByCodigo(codigo: IntencionCodigo): Promise<Intencion | null>;
  findAll(): Promise<Intencion[]>;
  save(intencion: Intencion): Promise<Intencion>;
  saveBatch(intenciones: Intencion[]): Promise<Intencion[]>;
}
