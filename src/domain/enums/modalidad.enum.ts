export enum Modalidad {
  ONSITE = 'ONSITE',
  VIRTUAL = 'VIRTUAL',
  HIBRYD = 'HIBRYD',
}

export const MODALIDAD_LABELS: Record<Modalidad, string> = {
  [Modalidad.ONSITE]: 'Presencial',
  [Modalidad.VIRTUAL]: 'Virtual',
  [Modalidad.HIBRYD]: 'Híbrido',
};
