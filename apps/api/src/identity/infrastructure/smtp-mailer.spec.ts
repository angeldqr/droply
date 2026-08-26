import { describe, expect, it, vi } from 'vitest';
import { Email } from '../domain/email';
import { SmtpMailer } from './smtp-mailer';

const sendMail = vi.fn<(payload: Record<string, unknown>) => Promise<unknown>>();

vi.mock('nodemailer', () => ({
  createTransport: () => ({ sendMail: (payload: Record<string, unknown>) => sendMail(payload) }),
}));

function mailer(): SmtpMailer {
  return new SmtpMailer({ host: 'localhost', port: 1025, from: 'no-responder@droply.app' });
}

const destinatario = Email.create('ana@droply.app');

function correo(): { to: Email; displayName: string; verificationUrl: string } {
  if (!destinatario.ok) throw new Error('el correo de la prueba no es válido');

  return { to: destinatario.value, displayName: 'Ana', verificationUrl: 'https://droply.app/x' };
}

describe('SmtpMailer', () => {
  /*
   * Estas dos son la prueba de lo que promete el puerto, y existen porque el
   * doble de los casos de uso nunca falla: con él, un SMTP caído se veía igual
   * que uno sano. Acá el transporte revienta a propósito.
   */
  it('no propaga el fallo del transporte', async () => {
    sendMail.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await expect(mailer().sendVerification(correo())).resolves.toBeUndefined();
  });

  it('tampoco lo propaga al pedir restablecer la contraseña', async () => {
    sendMail.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    if (!destinatario.ok) throw new Error('el correo de la prueba no es válido');

    await expect(
      mailer().sendPasswordReset({
        to: destinatario.value,
        displayName: 'Ana',
        resetUrl: 'https://droply.app/y',
      }),
    ).resolves.toBeUndefined();
  });

  it('manda el correo cuando el transporte responde', async () => {
    sendMail.mockResolvedValueOnce({});

    await mailer().sendVerification(correo());

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'ana@droply.app', from: 'no-responder@droply.app' }),
    );
  });
});
