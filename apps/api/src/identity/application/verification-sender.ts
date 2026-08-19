import type { Clock } from '../../shared/clock';
import type { IdGenerator } from '../../shared/identifiers';
import type { EmailVerificationRepository, Mailer, SecretTokenFactory } from '../domain/ports';
import type { User } from '../domain/user';

/** Una hora alcanza para abrir un correo; más tiempo solo agranda la ventana. */
export const VERIFICATION_LIFETIME_MS = 60 * 60 * 1000;

/**
 * Emite un enlace de verificación y lo manda.
 *
 * Estaba dentro del registro y salió de ahí cuando apareció el reenvío: son la
 * misma operación —token nuevo, hash guardado, correo enviado— y tenerla dos
 * veces significaba que un cambio en la vida del token o en la forma de la URL
 * había que acordarse de hacerlo en los dos lados.
 */
export class VerificationSender {
  constructor(
    private readonly verifications: EmailVerificationRepository,
    private readonly secrets: SecretTokenFactory,
    private readonly mailer: Mailer,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly webUrl: string,
  ) {}

  /**
   * Cada envío emite un token nuevo y deja vivos los anteriores hasta que
   * venzan. Invalidarlos obligaría a que quien pidió dos correos acertara con
   * el último, que es justo lo que confunde a quien ya no encuentra el primero.
   */
  async sendTo(user: User): Promise<void> {
    const now = this.clock.now();
    const secret = this.secrets.create();

    await this.verifications.add({
      id: this.ids.generate(),
      userId: user.id,
      tokenHash: secret.hash,
      expiresAt: new Date(now.getTime() + VERIFICATION_LIFETIME_MS),
      usedAt: null,
    });

    await this.mailer.sendVerification({
      to: user.email,
      displayName: user.displayName,
      verificationUrl: `${this.webUrl}/verificar-correo?token=${secret.value}`,
    });
  }
}
