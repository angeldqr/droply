import { InvalidInputError } from '../../shared/domain-error';
import { err, ok, type Result } from '../../shared/result';

/**
 * Una contraseña en claro que ya pasó la política, camino al hasher. Nunca se
 * persiste ni se loguea: `toJSON` y `toString` la tapan para que no se escape
 * por un `console.log` o por el serializador de un error.
 *
 * La política premia el largo por sobre los símbolos raros. Exigir mayúscula,
 * número y símbolo produce contraseñas cortas y predecibles como "Perro1!",
 * que se rompen antes que una frase larga.
 */
export class PlainPassword {
  static readonly minimumLength = 12;
  static readonly maximumLength = 200;

  private constructor(private readonly secret: string) {}

  static create(raw: string): Result<PlainPassword, InvalidInputError> {
    if (raw.length < PlainPassword.minimumLength) {
      return err(
        new InvalidInputError(
          'password.too_short',
          `La contraseña necesita al menos ${PlainPassword.minimumLength} caracteres.`,
        ),
      );
    }

    // El tope existe porque argon2 trabaja sobre la entrada completa: sin él,
    // alguien manda un texto de varios megas y ocupa la CPU del servidor.
    if (raw.length > PlainPassword.maximumLength) {
      return err(
        new InvalidInputError(
          'password.too_long',
          `La contraseña no puede pasar de ${PlainPassword.maximumLength} caracteres.`,
        ),
      );
    }

    if (raw.trim().length === 0) {
      return err(
        new InvalidInputError('password.blank', 'La contraseña no puede ser solo espacios.'),
      );
    }

    return ok(new PlainPassword(raw));
  }

  /** El único punto por donde sale el valor: se lo pasa al hasher y nada más. */
  reveal(): string {
    return this.secret;
  }

  toString(): string {
    return '[contraseña]';
  }

  toJSON(): string {
    return '[contraseña]';
  }
}
