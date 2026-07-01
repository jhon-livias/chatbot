export enum TipoPrograma {
  PREGRADO = 'PREGRADO',
  CAREERS_FOR_WORKERS = 'CAREERS_FOR_WORKERS',
  MAESTRIA = 'MAESTRIA',
  DOCTORADO = 'DOCTORADO',
  ESPECIALIZACION = 'ESPECIALIZACION',
  DIPLOMADO = 'DIPLOMADO',
  TECNOLOGO = 'TECNOLOGO',
  TECNICO = 'TECNICO',
}

export const TIPO_PROGRAMA_LABELS: Record<TipoPrograma, string> = {
  [TipoPrograma.PREGRADO]: 'Pregrado',
  [TipoPrograma.CAREERS_FOR_WORKERS]: 'Carreras para trabajadores',
  [TipoPrograma.MAESTRIA]: 'Maestría',
  [TipoPrograma.DOCTORADO]: 'Doctorado',
  [TipoPrograma.ESPECIALIZACION]: 'Especialización',
  [TipoPrograma.DIPLOMADO]: 'Diplomado',
  [TipoPrograma.TECNOLOGO]: 'Tecnólogo',
  [TipoPrograma.TECNICO]: 'Técnico',
};
