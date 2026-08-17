import type { VerificationMail } from '../domain/ports';

/**
 * El cuerpo del correo, en un solo lugar, para que los dos transportes manden
 * exactamente lo mismo.
 *
 * Sin imágenes ni hojas de estilo externas: los clientes de correo bloquean la
 * mitad de eso y el resultado se ve roto. Estilos en línea y poco más.
 */
export function verificationEmail(mail: VerificationMail): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = 'Confirmá tu correo en Droply';

  const text = [
    `Hola ${mail.displayName},`,
    '',
    'Para terminar de crear tu cuenta en Droply, abrí este enlace:',
    mail.verificationUrl,
    '',
    'Vence en una hora. Si no fuiste vos, ignorá este mensaje: sin abrirlo, la cuenta no se activa.',
  ].join('\n');

  const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:32px;background:#e1edf5;font-family:ui-sans-serif,system-ui,sans-serif;color:#0f1b26">
    <div style="max-width:480px;margin:0 auto;background:#faf8f4;border:1px solid #0f1b26;padding:32px">
      <p style="margin:0 0 24px;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#6b8199">Droply</p>
      <p style="margin:0 0 16px;font-size:16px">Hola ${escapeHtml(mail.displayName)},</p>
      <p style="margin:0 0 24px;font-size:16px;line-height:1.6">
        Para terminar de crear tu cuenta, confirmá que este correo es tuyo.
      </p>
      <p style="margin:0 0 24px">
        <a href="${escapeHtml(mail.verificationUrl)}"
           style="display:inline-block;background:#c75a3e;color:#faf8f4;padding:12px 24px;text-decoration:none">
          Confirmar mi correo
        </a>
      </p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#4e6377">
        El enlace vence en una hora. Si no fuiste vos, ignorá este mensaje: sin abrirlo, la cuenta no se activa.
      </p>
    </div>
  </body>
</html>`;

  return { subject, text, html };
}

/**
 * El nombre lo escribe el usuario, así que va escapado: si no, un nombre con
 * `<script>` termina ejecutándose en el cliente de correo de quien lo reciba.
 */
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
