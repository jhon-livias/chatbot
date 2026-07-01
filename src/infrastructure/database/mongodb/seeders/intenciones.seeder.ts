import { randomUUID } from 'node:crypto';
import { IntencionCodigo } from '../../../../domain/enums/intencion-codigo.enum.js';
import { Intencion } from '../../../../domain/entities/intencion.entity.js';
import type { IntencionRepository } from '../../../../domain/repositories/intencion.repository.js';

/**
 * Las 7 intenciones base del sistema de chatbot UPRIT.
 * El seeder es idempotente: usa `$setOnInsert` para no sobreescribir
 * registros existentes si el seeder se ejecuta más de una vez.
 */
export const INTENCIONES_BASE: Array<Omit<ReturnType<Intencion['toProps']>, 'id'> & { id: string }> = [
  {
    id: randomUUID(),
    codigo: IntencionCodigo.IDENTIFICAR_INTENCION,
    titulo: 'Identificar Intención',
    descripcion:
      'Analiza el mensaje del usuario y clasifica su intención dentro de las categorías disponibles del sistema. ' +
      'Este es el punto de entrada del flujo conversacional que determina el siguiente paso.',
  },
  {
    id: randomUUID(),
    codigo: IntencionCodigo.INFORMACION_PROGRAMAS,
    titulo: 'Información de Programas',
    descripcion:
      'El usuario solicita información detallada sobre uno o varios programas académicos: ' +
      'duración, modalidades, título otorgado, perfil del egresado, campo laboral y requisitos.',
  },
  {
    id: randomUUID(),
    codigo: IntencionCodigo.PROCESO_ADMISION,
    titulo: 'Proceso de Admisión',
    descripcion:
      'El usuario pregunta sobre el proceso de admisión: fechas, documentos requeridos, ' +
      'costos de matrícula, pruebas de admisión, becas y financiación.',
  },
  {
    id: randomUUID(),
    codigo: IntencionCodigo.PROGRAMAS_POR_CATEGORIA,
    titulo: 'Programas por Categoría',
    descripcion:
      'El usuario desea explorar programas filtrados por tipo (pregrado, maestría, doctorado), ' +
      'modalidad (presencial, virtual, híbrido) o facultad.',
  },
  {
    id: randomUUID(),
    codigo: IntencionCodigo.SOLICITAR_MAS_INFORMACION,
    titulo: 'Solicitar Más Información',
    descripcion:
      'El usuario quiere recibir información adicional por otro canal (correo, llamada) o ' +
      'hablar con un asesor humano (handoff). Se activa la notificación al agente.',
  },
  {
    id: randomUUID(),
    codigo: IntencionCodigo.GENERAR_QUERY_EMBEDDINGS,
    titulo: 'Generar Query para Embeddings',
    descripcion:
      'Genera una consulta optimizada para búsqueda semántica (RAG) en la base de conocimiento. ' +
      'Transforma el mensaje del usuario en un query limpio y sin ambigüedades para el motor de vectores.',
  },
  {
    id: randomUUID(),
    codigo: IntencionCodigo.RESOLVER_DUDAS,
    titulo: 'Resolver Dudas',
    descripcion:
      'Resuelve preguntas generales sobre la universidad que no encajan en las categorías anteriores: ' +
      'campus, servicios estudiantiles, eventos, convenios internacionales, etc.',
  },
];

export async function seedIntenciones(repo: IntencionRepository): Promise<void> {
  const intenciones = INTENCIONES_BASE.map((data) => Intencion.create(data));
  await repo.saveBatch(intenciones);
}
