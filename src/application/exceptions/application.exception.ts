/**
 * Excepción base de la capa de Aplicación.
 * A diferencia de DomainException (reglas de negocio), ApplicationException
 * cubre fallos de orquestación: parsing, validación de datos externos, etc.
 */
export class ApplicationException extends Error {
  readonly code: string;

  constructor(message: string, code = 'APPLICATION_ERROR') {
    super(message);
    this.name = 'ApplicationException';
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}
