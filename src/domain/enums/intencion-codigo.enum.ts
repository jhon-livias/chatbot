/**
 * Identificadores estables para las intenciones que el LLM devuelve al parsear
 * el mensaje del usuario (capa de aplicación). Distintos de los `type` almacenados
 * en la colección `funnel_intentions` (ej. IDENTIFY_NEED).
 */
export enum IntencionCodigo {
  IDENTIFICAR_INTENCION = 'IDENTIFICAR_INTENCION',
  INFORMACION_PROGRAMAS = 'INFORMACION_PROGRAMAS',
  PROCESO_ADMISION = 'PROCESO_ADMISION',
  PROGRAMAS_POR_CATEGORIA = 'PROGRAMAS_POR_CATEGORIA',
  SOLICITAR_MAS_INFORMACION = 'SOLICITAR_MAS_INFORMACION',
  GENERAR_QUERY_EMBEDDINGS = 'GENERAR_QUERY_EMBEDDINGS',
  RESOLVER_DUDAS = 'RESOLVER_DUDAS',
}
