import { DomainException } from '../exceptions/domain.exception.js';

/** Valor inmutable que representa un número de teléfono en formato E.164 */
export class PhoneNumber {
  private static readonly E164_REGEX = /^\+[1-9]\d{7,14}$/;

  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(raw: string): PhoneNumber {
    const normalized = raw.trim().replace(/\s+/g, '');
    if (!PhoneNumber.E164_REGEX.test(normalized)) {
      throw new DomainException(
        `Número de teléfono inválido: "${raw}". Debe estar en formato E.164 (ej. +5215512345678)`,
      );
    }
    return new PhoneNumber(normalized);
  }

  equals(other: PhoneNumber): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
