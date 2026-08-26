import type { PasswordResetMail, VerificationMail } from '../domain/ports';

/**
 * Los cuerpos de los correos, en un solo sitio, para que los dos transportes
 * manden exactamente lo mismo.
 *
 * Sin imágenes ni hojas de estilo externas: los clientes de correo bloquean la
 * mitad de eso y el resultado se ve roto. Estilos en línea y poco más.
 */

/** La paleta, copiada a mano: un correo no puede leer los tokens de CSS. */
const TINTA = '#2f184b';
const ACENTO = '#532b88';
const FONDO = '#f4effa';
const PAPEL = '#ffffff';
const SUAVE = '#6b5b80';

export function verificationEmail(mail: VerificationMail): {
  subject: string;
  text: string;
  html: string;
} {
  const cierre =
    'El enlace vence en una hora. Si no fuiste tú, ignora este mensaje: sin abrirlo, la cuenta no se activa.';

  return {
    subject: 'Confirma tu correo en Reconéctate',
    text: [
      `Hola ${mail.displayName},`,
      '',
      'Para terminar de crear tu cuenta en Reconéctate, abre este enlace:',
      mail.verificationUrl,
      '',
      cierre,
    ].join('\n'),
    html: shell({
      displayName: mail.displayName,
      lead: 'Para terminar de crear tu cuenta, confirma que este correo es tuyo.',
      url: mail.verificationUrl,
      action: 'Confirmar mi correo',
      footer: cierre,
    }),
  };
}

export function passwordResetEmail(mail: PasswordResetMail): {
  subject: string;
  text: string;
  html: string;
} {
  /*
   * El cierre dice qué hacer si no fuiste tú, y dice la verdad: pedir el enlace
   * no cambia nada por sí solo. Sin esa frase, quien reciba un correo que no
   * pidió se asusta y cambia una contraseña que nadie estaba tocando.
   */
  const cierre =
    'El enlace vence en una hora y sirve una sola vez. Si no lo pediste, ignora este mensaje: tu contraseña sigue siendo la de siempre.';

  return {
    subject: 'Vuelve a entrar a Reconéctate',
    text: [
      `Hola ${mail.displayName},`,
      '',
      'Para poner una contraseña nueva, abre este enlace:',
      mail.resetUrl,
      '',
      cierre,
    ].join('\n'),
    html: shell({
      displayName: mail.displayName,
      lead: 'Pediste volver a entrar. Con este enlace pones una contraseña nueva.',
      url: mail.resetUrl,
      action: 'Poner una contraseña nueva',
      footer: cierre,
    }),
  };
}

function shell(content: {
  displayName: string;
  lead: string;
  url: string;
  action: string;
  footer: string;
}): string {
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:32px;background:${FONDO};font-family:ui-sans-serif,system-ui,sans-serif;color:${TINTA}">
    <div style="max-width:480px;margin:0 auto;background:${PAPEL};border:1px solid ${TINTA};padding:32px">
      <p style="margin:0 0 24px;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:${SUAVE}">Reconéctate</p>
      <p style="margin:0 0 16px;font-size:16px">Hola ${escapeHtml(content.displayName)},</p>
      <p style="margin:0 0 24px;font-size:16px;line-height:1.6">${escapeHtml(content.lead)}</p>
      <p style="margin:0 0 24px">
        <a href="${escapeHtml(content.url)}"
           style="display:inline-block;background:${ACENTO};color:${PAPEL};padding:12px 24px;text-decoration:none">
          ${escapeHtml(content.action)}
        </a>
      </p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:${SUAVE}">${escapeHtml(content.footer)}</p>
    </div>
  </body>
</html>`;
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
