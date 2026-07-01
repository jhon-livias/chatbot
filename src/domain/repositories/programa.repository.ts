import type { Programa } from '../entities/programa.entity.js';
import type { TipoPrograma } from '../enums/tipo-programa.enum.js';
import type { Modalidad } from '../enums/modalidad.enum.js';

export interface ProgramaRepository {
  findById(id: string): Promise<Programa | null>;
  findBySlug(slug: string): Promise<Programa | null>;
  findAll(): Promise<Programa[]>;
  findActivos(): Promise<Programa[]>;
  findByTipo(tipo: TipoPrograma): Promise<Programa[]>;
  findByModalidad(modalidad: Modalidad): Promise<Programa[]>;
  findByFacultyId(facultyId: string): Promise<Programa[]>;
  /** Búsqueda de texto completo sobre name, summary, iaInformation y searchText */
  search(query: string): Promise<Programa[]>;
  save(programa: Programa): Promise<Programa>;
  delete(id: string): Promise<void>;
}
