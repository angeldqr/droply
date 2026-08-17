import { createTransport, type Transporter } from 'nodemailer';
import type { Mailer, VerificationMail } from '../domain/ports';
import { verificationEmail } from './verification-email';

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

  async sendVerification(mail: VerificationMail): Promise<void> {
    const body = verificationEmail(mail);

    await this.transport.sendMail({
      from: this.settings.from,
      to: mail.to.value,
      subject: body.subject,
      text: body.text,
      html: body.html,
    });
  }
}
