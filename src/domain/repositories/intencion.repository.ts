import type { Intencion } from '../entities/intencion.entity.js';

export interface IntencionRepository {
  findById(id: string): Promise<Intencion | null>;
  findByType(type: string): Promise<Intencion | null>;
  findAll(): Promise<Intencion[]>;
  findActivas(): Promise<Intencion[]>;
  save(intencion: Intencion): Promise<Intencion>;
  saveBatch(intenciones: Intencion[]): Promise<Intencion[]>;
  delete(id: string): Promise<void>;
}
