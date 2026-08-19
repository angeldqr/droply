import { err, ok, type Result } from '../../shared/result';
import { Email } from '../domain/email';
import { InvalidCredentials } from '../domain/errors';
import type { PasswordHasher, UserRepository } from '../domain/ports';
import type { AuthenticatedSession, SessionIssuer } from './session-issuer';

export interface LoginInput {
  readonly email: string;
  readonly password: string;
}

export class LoginUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionIssuer,
  ) {}

  async execute(input: LoginInput): Promise<Result<AuthenticatedSession, InvalidCredentials>> {
    const email = Email.create(input.email);

    // Un correo mal formado sale por la misma puerta que una contraseña
    // equivocada: si respondiera distinto, serviría para tantear direcciones.
    if (!email.ok) return err(new InvalidCredentials());

    const user = await this.users.findByEmail(email.value);

    if (!user) {
      // Se gasta el mismo trabajo de verificación que en el camino exitoso.
      // Sin esto, la diferencia de tiempo entre "no existe" y "contraseña
      // incorrecta" delata qué correos están registrados.
      await this.hasher.verify(DUMMY_HASH, input.password);
      return err(new InvalidCredentials());
    }

    const result = await this.hasher.verify(user.hashedPassword, input.password);
    if (!result.matches) return err(new InvalidCredentials());

    /*
     * Una cuenta desactivada responde igual que una contraseña incorrecta.
     *
     * Se comprueba **después** de verificar, no antes: si se cortara arriba,
     * el tiempo de respuesta distinguiría una cuenta desactivada de una que no
     * existe, que es justo lo que el hash de relleno de más arriba evita.
     */
    if (!user.isActive) return err(new InvalidCredentials());

    // Si los parámetros de argon2 subieron desde que se creó la cuenta, este es
    // el único momento en que existe la contraseña en claro para rehacerlo.
    if (result.needsRehash) {
      user.changePassword(await this.hasher.hash(input.password));
      await this.users.save(user);
    }

    return ok({ session: await this.sessions.openSession(user), user });
  }
}

/**
 * Hash de argon2id sobre una contraseña que nadie usa, solo para consumir el
 * mismo tiempo cuando la cuenta no existe.
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$Iy8vE2Xz3lGhLmVBYUCX0Hs1EPZIH5rGZzZTaCcnAEg';
