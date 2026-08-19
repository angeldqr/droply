import type { Clock } from '../../shared/clock';
import type { UserId } from '../../shared/identifiers';
import { err, ok, type Result } from '../../shared/result';
import { Email } from '../domain/email';
import { CurrentPasswordWrong, ResetLinkInvalid } from '../domain/errors';
import { PlainPassword } from '../domain/password';
import type {
  PasswordHasher,
  PasswordResetRepository,
  RefreshTokenRepository,
  SecretTokenFactory,
  UserRepository,
} from '../domain/ports';
import type { InvalidInputError } from '../../shared/domain-error';
import type { PasswordResetSender } from './password-reset-sender';

/**
 * Cambia la contraseña de quien ya entró.
 *
 * Se pide la actual aunque haya sesión abierta: si alguien se sienta frente a
 * una pantalla desbloqueada, sin ese paso se lleva la cuenta entera. Es la
 * única barrera que queda cuando la sesión ya está.
 */
export class ChangePassword {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly sessions: RefreshTokenRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    userId: UserId,
    input: { currentPassword: string; newPassword: string },
  ): Promise<Result<void, CurrentPasswordWrong | InvalidInputError>> {
    const user = await this.users.findById(userId);

    // La sesión venía de un token válido, así que la cuenta existe. Si no
    // estuviera, algo se borró en medio y no hay contraseña que cambiar.
    if (!user) return err(new CurrentPasswordWrong());

    const password = PlainPassword.create(input.newPassword);
    if (!password.ok) return password;

    const current = await this.hasher.verify(user.hashedPassword, input.currentPassword);
    if (!current.matches) return err(new CurrentPasswordWrong());

    user.changePassword(await this.hasher.hash(password.value.reveal()));
    await this.users.save(user);

    // Cambiar la contraseña porque sospechas que alguien entró no sirve de nada
    // si su sesión sigue viva. Se cierran todas, incluida la de quien la cambia.
    await this.sessions.revokeAllOf(userId, this.clock.now());

    return ok();
  }
}

/**
 * Pide el enlace para volver a poner la contraseña.
 *
 * **Responde igual exista la cuenta o no.** Contestar distinto convertiría esta
 * ruta en un buscador de correos registrados, que es exactamente lo que se
 * evita en el login y en los códigos de vinculación.
 *
 * Una cuenta desactivada tampoco recibe enlace: recuperarla no depende de ella
 * sino de quien administra. Y desde fuera no se nota, porque la respuesta es la
 * misma que para un correo que no existe.
 */
export class RequestPasswordReset {
  constructor(
    private readonly users: UserRepository,
    private readonly sender: PasswordResetSender,
  ) {}

  async execute(rawEmail: string): Promise<void> {
    const email = Email.create(rawEmail);
    if (!email.ok) return;

    const user = await this.users.findByEmail(email.value);
    if (!user || !user.isActive) return;

    await this.sender.sendTo(user);
  }
}

/** Pone la contraseña nueva con el enlace del correo. */
export class ResetPassword {
  constructor(
    private readonly users: UserRepository,
    private readonly resets: PasswordResetRepository,
    private readonly secrets: SecretTokenFactory,
    private readonly hasher: PasswordHasher,
    private readonly sessions: RefreshTokenRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    token: string,
    newPassword: string,
  ): Promise<Result<void, ResetLinkInvalid | InvalidInputError>> {
    const password = PlainPassword.create(newPassword);
    if (!password.ok) return password;

    const now = this.clock.now();
    const record = await this.resets.findByHash(this.secrets.hash(token));

    // Inexistente, vencido y ya usado responden lo mismo a propósito.
    if (!record || record.usedAt !== null || record.expiresAt <= now) {
      return err(new ResetLinkInvalid());
    }

    const user = await this.users.findById(record.userId);
    if (!user || !user.isActive) return err(new ResetLinkInvalid());

    // Se quema antes de tocar la contraseña: si algo falla después, el enlace
    // ya no sirve, que es el lado por el que conviene equivocarse.
    await this.resets.markUsed(record.id, now);

    user.changePassword(await this.hasher.hash(password.value.reveal()));
    await this.users.save(user);

    /*
     * Quien pide restablecer la contraseña suele ser justo quien cree que
     * alguien más entró. Dejar vivas las sesiones abiertas dejaría dentro a esa
     * persona, con la contraseña nueva sin enterarse siquiera.
     */
    await this.sessions.revokeAllOf(user.id, now);

    return ok();
  }
}
