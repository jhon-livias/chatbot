/** Etapa del embudo de conversión en la que se encuentra el prospecto */
export enum FunnelEtapa {
  /** Primera interacción — el usuario descubre la universidad */
  AWARENESS = 'AWARENESS',
  /** El usuario evalúa y compara programas académicos */
  CONSIDERATION = 'CONSIDERATION',
  /** El usuario está listo para aplicar o solicitar más información */
  DECISION = 'DECISION',
  /** El usuario ya inició el proceso de admisión */
  ADMISION = 'ADMISION',
  /** El usuario es ya estudiante activo */
  RETENCION = 'RETENCION',
}
