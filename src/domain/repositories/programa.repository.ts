import type { Programa } from '../entities/programa.entity.js';
import type { TipoPrograma } from '../enums/tipo-programa.enum.js';
import type { Modalidad } from '../enums/modalidad.enum.js';

export interface ProgramaRepository {
  findById(id: string): Promise<Programa | null>;
  findAll(): Promise<Programa[]>;
  findByTipo(tipo: TipoPrograma): Promise<Programa[]>;
  findByModalidad(modalidad: Modalidad): Promise<Programa[]>;
  findByFacultad(facultad: string): Promise<Programa[]>;
  /** Búsqueda de texto completo sobre nombre, resumen y detalle_para_ia */
  search(query: string): Promise<Programa[]>;
  save(programa: Programa): Promise<Programa>;
  delete(id: string): Promise<void>;
}
