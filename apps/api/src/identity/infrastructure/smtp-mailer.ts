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

  private async send(
    to: string,
    body: { subject: string; text: string; html: string },
  ): Promise<void> {
    await this.transport.sendMail({
      from: this.settings.from,
      to,
      subject: body.subject,
      text: body.text,
      html: body.html,
    });
  }
}
