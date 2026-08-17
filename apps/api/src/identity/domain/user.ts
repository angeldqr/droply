import { InvalidInputError, PreconditionFailedError } from '../../shared/domain-error';
import type { UserId } from '../../shared/identifiers';
import { err, ok, type Result } from '../../shared/result';
import type { Email } from './email';

/**
 * El estado plano del usuario, tal como entra y sale del repositorio. El
 * correo va como `Email` y no como string: al reconstruir desde la base, si
 * viniera suelto habría dos fuentes para el mismo dato y nada impediría que
 * se contradigan.
 */
export interface UserSnapshot {
  readonly id: UserId;
  readonly email: Email;
  readonly passwordHash: string;
  readonly displayName: string;
  readonly timezone: string;
  readonly emailVerifiedAt: Date | null;
  readonly createdAt: Date;
}

export class User {
  private constructor(
    readonly id: UserId,
    readonly email: Email,
    private passwordHash: string,
    readonly displayName: string,
    readonly timezone: string,
    private emailVerifiedAt: Date | null,
    readonly createdAt: Date,
  ) {}

  static register(input: {
    id: UserId;
    email: Email;
    passwordHash: string;
    displayName: string;
    timezone: string;
    now: Date;
  }): Result<User, InvalidInputError> {
    const displayName = input.displayName.trim();

    if (displayName.length < 2) {
      return err(new InvalidInputError('display_name.too_short', 'Poné al menos dos caracteres.'));
    }

    if (displayName.length > 80) {
      return err(new InvalidInputError('display_name.too_long', 'Ese nombre es demasiado largo.'));
    }

    if (!isIanaTimezone(input.timezone)) {
      return err(
        new InvalidInputError(
          'timezone.invalid',
          'Necesito una zona horaria IANA, por ejemplo America/Bogota.',
        ),
      );
    }

    return ok(
      new User(
        input.id,
        input.email,
        input.passwordHash,
        displayName,
        input.timezone,
        null,
        input.now,
      ),
    );
  }

  static fromSnapshot(snapshot: UserSnapshot): User {
    return new User(
      snapshot.id,
      snapshot.email,
      snapshot.passwordHash,
      snapshot.displayName,
      snapshot.timezone,
      snapshot.emailVerifiedAt,
      snapshot.createdAt,
    );
  }

  get isEmailVerified(): boolean {
    return this.emailVerifiedAt !== null;
  }

  /**
   * Sin correo verificado no se puede programar nada. Es lo único que separa a
   * la aplicación de ser una máquina de mandar spam a números ajenos.
   */
  ensureCanSchedule(): Result<void, PreconditionFailedError> {
    if (!this.isEmailVerified) {
      return err(
        new PreconditionFailedError(
          'email.not_verified',
          'Verificá tu correo antes de programar envíos.',
        ),
      );
    }

    return ok();
  }

  verifyEmail(now: Date): void {
    // Verificar dos veces no es un error: el usuario hizo clic dos veces en el
    // mismo enlace. Se conserva la fecha original.
    this.emailVerifiedAt ??= now;
  }

  get hashedPassword(): string {
    return this.passwordHash;
  }

  changePassword(newHash: string): void {
    this.passwordHash = newHash;
  }

  toSnapshot(): UserSnapshot {
    return {
      id: this.id,
      email: this.email,
      passwordHash: this.passwordHash,
      displayName: this.displayName,
      timezone: this.timezone,
      emailVerifiedAt: this.emailVerifiedAt,
      createdAt: this.createdAt,
    };
  }
}

/**
 * `Intl` ya trae la base de datos de zonas horarias, así que no hace falta
 * arrastrar una dependencia solo para esto.
 */
function isIanaTimezone(candidate: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate });
    return true;
  } catch {
    return false;
  }
}
