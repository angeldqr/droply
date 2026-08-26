import { Logger } from '@nestjs/common';
import type { Mailer, PasswordResetMail, VerificationMail } from '../domain/ports';
import { passwordResetEmail, verificationEmail } from './emails';

/**
 * Manda los correos por la API de Resend.
 *
 * Es el camino principal en la máquina virtual, y no SMTP, por una razón muy
 * concreta: los proveedores de VPS bloquean el puerto 25 de salida casi
 * siempre y el 587 a menudo, así que un correo por SMTP puede quedarse en un
 * tiempo de espera sin que nada lo anuncie. Esto va por HTTPS al 443.
 *
 * Sin el SDK de Resend: la llamada es un POST con un JSON de cinco campos, y
 * `fetch` viene en Node. Una dependencia para eso solo agrega algo que
 * actualizar.
 */
export interface ResendSettings {
  readonly apiKey: string;
  readonly from: string;
}

const ENDPOINT = 'https://api.resend.com/emails';

/** Si Resend no contesta en diez segundos, no va a contestar. */
const TIMEOUT_MS = 10_000;

export class ResendMailer implements Mailer {
  private readonly logger = new Logger('Mailer');

  constructor(private readonly settings: ResendSettings) {}

  sendVerification(mail: VerificationMail): Promise<void> {
    return this.send(mail.to.value, verificationEmail(mail));
  }

  sendPasswordReset(mail: PasswordResetMail): Promise<void> {
    return this.send(mail.to.value, passwordResetEmail(mail));
  }

  /**
   * No propaga el fallo, por lo que dice el puerto: un correo que no sale no
   * puede tumbar la petición que lo pidió.
   *
   * Un 4xx de Resend se registra igual que una caída de red, y a propósito: la
   * clave vencida y el dominio sin verificar son los dos fallos que de verdad
   * pasan, y los dos devuelven 4xx con el motivo en el cuerpo. Por eso se
   * registra el cuerpo y no solo el código.
   */
  private async send(
    to: string,
    body: { subject: string; text: string; html: string },
  ): Promise<void> {
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.settings.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: this.settings.from,
          to,
          subject: body.subject,
          text: body.text,
          html: body.html,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!response.ok) {
        this.logger.error(
          `Resend rechazó el correo "${body.subject}" para ${to}: ${response.status} ${await response.text()}`,
        );
      }
    } catch (caught) {
      this.logger.error(`No salió el correo "${body.subject}" para ${to}`, caught);
    }
  }
}
