import { Logger } from '@nestjs/common';
import type { Mailer, PasswordResetMail, VerificationMail } from '../domain/ports';

/**
 * Escribe el enlace de verificación en el log en lugar de mandar un correo.
 * Es para desarrollo, donde no hay ningún SMTP a mano y lo único que hace
 * falta es poder abrir el enlace.
 *
 * Ese enlace alcanza para tomar la cuenta, así que esto no se activa solo:
 * hay que pedirlo con `MAIL_TRANSPORT=log`, y el módulo lo grita al arrancar.
 */
export class LoggingMailer implements Mailer {
  private readonly logger = new Logger('Mailer');

  sendVerification(mail: VerificationMail): Promise<void> {
    this.logger.log(`Verificación para ${mail.to.value}: ${mail.verificationUrl}`);

    return Promise.resolve();
  }

  sendPasswordReset(mail: PasswordResetMail): Promise<void> {
    this.logger.log(`Restablecer contraseña de ${mail.to.value}: ${mail.resetUrl}`);

    return Promise.resolve();
  }
}
