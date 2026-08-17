import { InvalidInputError } from '../../shared/domain-error';
import { err, ok, type Result } from '../../shared/result';

/**
 * Un correo ya normalizado. Existe para que no circulen strings sueltos que
 * unos comparan en minúscula y otros no, y termine habiendo dos cuentas para
 * la misma persona.
 *
 * No intenta validar contra la gramática completa del RFC 5322: eso da falsos
 * negativos con direcciones legítimas. Lo que decide de verdad si la dirección
 * existe es el correo de verificación.
 */
export class Email {
  private constructor(readonly value: string) {}

  static create(raw: string): Result<Email, InvalidInputError> {
    const normalized = raw.trim().toLowerCase();

    if (normalized.length === 0) {
      return err(new InvalidInputError('email.required', 'Hace falta un correo.'));
    }

    if (normalized.length > 254) {
      return err(new InvalidInputError('email.too_long', 'El correo es demasiado largo.'));
    }

    const at = normalized.indexOf('@');
    const domain = normalized.slice(at + 1);

    const shaped =
      at > 0 &&
      normalized.indexOf('@', at + 1) === -1 &&
      domain.includes('.') &&
      !domain.startsWith('.') &&
      !domain.endsWith('.') &&
      !normalized.includes(' ');

    if (!shaped) {
      return err(new InvalidInputError('email.invalid', 'Ese correo no tiene forma de correo.'));
    }

    return ok(new Email(normalized));
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
