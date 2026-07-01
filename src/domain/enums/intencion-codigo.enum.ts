/**
 * Identificadores estables para las 7 intenciones base del sistema.
 * Se usan como slug único en la colección `intenciones` y como referencia
 * en el código (evita hardcodear strings arbitrarios).
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
