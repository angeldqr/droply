import { Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import type { Mailer, PasswordResetMail, VerificationMail } from '../domain/ports';
import { passwordResetEmail, verificationEmail } from './emails';

export interface SmtpSettings {
  readonly host: string;
  readonly port: number;
  readonly user?: string | undefined;
  readonly password?: string | undefined;
  readonly from: string;
}

export class SmtpMailer implements Mailer {
  private readonly logger = new Logger('Mailer');
  private readonly transport: Transporter;

  constructor(private readonly settings: SmtpSettings) {
    this.transport = createTransport({
      host: settings.host,
      port: settings.port,
      // El 465 es TLS implícito; el 587 arranca en claro y sube con STARTTLS.
      secure: settings.port === 465,
      ...(settings.user ? { auth: { user: settings.user, pass: settings.password ?? '' } } : {}),
    });
  }

  sendVerification(mail: VerificationMail): Promise<void> {
    return this.send(mail.to.value, verificationEmail(mail));
  }

  sendPasswordReset(mail: PasswordResetMail): Promise<void> {
    return this.send(mail.to.value, passwordResetEmail(mail));
  }

  /**
   * No propaga el fallo, por lo que dice el puerto: un SMTP caído no puede
   * llevarse por delante la petición que pidió el correo.
   *
   * Queda en el log con el destinatario, que es lo que hace falta para
   * reenviarlo a mano. El asunto también, porque distingue cuál de los dos
   * correos se perdió sin tener que mirar el código.
   */
  private async send(
    to: string,
    body: { subject: string; text: string; html: string },
  ): Promise<void> {
    try {
      await this.transport.sendMail({
        from: this.settings.from,
        to,
        subject: body.subject,
        text: body.text,
        html: body.html,
      });
    } catch (caught) {
      this.logger.error(`No salió el correo "${body.subject}" para ${to}`, caught);
    }
  }
}
