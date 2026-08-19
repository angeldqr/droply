import { InvalidInputError, PreconditionFailedError } from '../../shared/domain-error';
import type { UserId } from '../../shared/identifiers';
import { err, ok, type Result } from '../../shared/result';
import type { Email } from './email';

/**
 * Quién administra y quién no. Copia del vocabulario del contrato, porque el
 * núcleo no puede importarlo; un test guardián los compara.
 */
export const USER_ROLES = ['USER', 'ADMIN'] as const;

export type UserRole = (typeof USER_ROLES)[number];

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
  readonly role: UserRole;
  readonly timezone: string;
  readonly emailVerifiedAt: Date | null;
  readonly deactivatedAt: Date | null;
  readonly createdAt: Date;
}

export class User {
  private constructor(
    readonly id: UserId,
    readonly email: Email,
    private passwordHash: string,
    readonly displayName: string,
    private currentRole: UserRole,
    readonly timezone: string,
    private emailVerifiedAt: Date | null,
    private deactivatedAt: Date | null,
    readonly createdAt: Date,
  ) {}

  static register(input: {
    id: UserId;
    email: Email;
    passwordHash: string;
    displayName: string;
    /** Solo el script de arranque y otro administrador crean administradores. */
    role?: UserRole;
    timezone: string;
    now: Date;
  }): Result<User, InvalidInputError> {
    const displayName = input.displayName.trim();

    if (displayName.length < 2) {
      return err(
        new InvalidInputError('display_name.too_short', 'Escribe al menos dos caracteres.'),
      );
    }

    if (displayName.length > 80) {
      return err(new InvalidInputError('display_name.too_long', 'Ese nombre es demasiado largo.'));
    }

    if (!isIanaTimezone(input.timezone)) {
      return err(
        new InvalidInputError(
          'timezone.invalid',
          'Elige una zona horaria válida, por ejemplo America/Bogota.',
        ),
      );
    }

    return ok(
      new User(
        input.id,
        input.email,
        input.passwordHash,
        displayName,
        input.role ?? 'USER',
        input.timezone,
        null,
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
      snapshot.role,
      snapshot.timezone,
      snapshot.emailVerifiedAt,
      snapshot.deactivatedAt,
      snapshot.createdAt,
    );
  }

  get isEmailVerified(): boolean {
    return this.emailVerifiedAt !== null;
  }

  get role(): UserRole {
    return this.currentRole;
  }

  get isAdmin(): boolean {
    return this.currentRole === 'ADMIN';
  }

  /**
   * Le da el papel de administrador.
   *
   * Solo lo llama el arranque, que resuelve `ADMIN_EMAIL`. No hay ninguna ruta
   * que ascienda a nadie: quien quiera otro administrador lo declara en el
   * entorno, que es donde vive el resto de las decisiones del despliegue.
   */
  promoteToAdmin(): void {
    this.currentRole = 'ADMIN';
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
          'Verifica tu correo antes de programar envíos.',
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

  get isActive(): boolean {
    return this.deactivatedAt === null;
  }

  /**
   * Le corta el acceso sin borrar nada.
   *
   * Sus bibliotecas, sus destinatarios y sus horarios se quedan donde están: si
   * la cuenta vuelve, vuelve entera. Lo único que cambia es que no puede entrar,
   * y por eso el login la trata igual que a una credencial que no existe.
   *
   * Desactivar dos veces conserva la fecha original, igual que verificar dos
   * veces el correo: es el mismo botón apretado otra vez, no un error.
   */
  deactivate(now: Date): void {
    this.deactivatedAt ??= now;
  }

  reactivate(): void {
    this.deactivatedAt = null;
  }

  toSnapshot(): UserSnapshot {
    return {
      id: this.id,
      email: this.email,
      passwordHash: this.passwordHash,
      displayName: this.displayName,
      role: this.currentRole,
      timezone: this.timezone,
      emailVerifiedAt: this.emailVerifiedAt,
      deactivatedAt: this.deactivatedAt,
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
