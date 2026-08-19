import type { Clock } from '../../shared/clock';
import type { IdGenerator } from '../../shared/identifiers';
import type { Mailer, PasswordResetRepository, SecretTokenFactory } from '../domain/ports';
import type { User } from '../domain/user';

/**
 * Una hora, igual que el enlace de verificación.
 *
 * Es el tiempo de ir al correo y volver. Más margen no ayuda a nadie que esté
 * mirando su bandeja y solo agranda la ventana en la que un enlace filtrado
 * todavía sirve para entrar.
 */
export const RESET_LIFETIME_MS = 60 * 60 * 1000;

/**
 * Emite un enlace para volver a poner la contraseña y lo manda.
 *
 * Gemelo de `VerificationSender`, y aparte por lo mismo que aquel: son la misma
 * operación —token nuevo, hash guardado, correo enviado— y quien la necesita es
 * más de uno.
 */
export class PasswordResetSender {
  constructor(
    private readonly resets: PasswordResetRepository,
    private readonly secrets: SecretTokenFactory,
    private readonly mailer: Mailer,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly webUrl: string,
  ) {}

  async sendTo(user: User): Promise<void> {
    const now = this.clock.now();
    const secret = this.secrets.create();

    await this.resets.add({
      id: this.ids.generate(),
      userId: user.id,
      tokenHash: secret.hash,
      expiresAt: new Date(now.getTime() + RESET_LIFETIME_MS),
      usedAt: null,
    });

    await this.mailer.sendPasswordReset({
      to: user.email,
      displayName: user.displayName,
      resetUrl: `${this.webUrl}/restablecer-contrasena?token=${secret.value}`,
    });
  }
}
