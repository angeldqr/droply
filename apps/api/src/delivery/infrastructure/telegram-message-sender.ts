import { Logger } from '@nestjs/common';
import type { MessageSender, Payload, SendResult } from '../domain/ports';

/**
 * Qué método del bot corresponde a cada columna, y bajo qué nombre viaja el
 * archivo. Telegram exige los dos, y no son intercambiables: mandar un mp3 por
 * `sendDocument` llega como adjunto sin reproductor.
 */
const METHODS = {
  IMAGE: { method: 'sendPhoto', field: 'photo' },
  VIDEO: { method: 'sendVideo', field: 'video' },
  AUDIO: { method: 'sendAudio', field: 'audio' },
} as const;

/**
 * Errores que no se arreglan reintentando.
 *
 * Telegram los devuelve como 403 o 400 con una descripción estable. Un horario
 * que choca con uno de estos no tiene arreglo automático: la otra persona
 * bloqueó al bot o borró la conversación, y hay que avisarle al dueño en vez de
 * empujar contra la puerta cada día a la misma hora.
 */
const PERMANENT = [
  'bot was blocked by the user',
  'user is deactivated',
  'chat not found',
  "bot can't initiate conversation",
  'peer_id_invalid',
];

export class TelegramMessageSender implements MessageSender {
  private readonly logger = new Logger(TelegramMessageSender.name);
  private readonly base: string;

  constructor(botToken: string) {
    this.base = `https://api.telegram.org/bot${botToken}`;
  }

  async send(
    chatId: string,
    payload: Payload,
    caption: string,
    bytes: Uint8Array | null,
  ): Promise<SendResult> {
    if (payload.kind === 'TEXT') {
      // El texto va tal cual, con el remitente en una línea aparte para que se
      // distinga de lo que escribió el dueño.
      return this.call('sendMessage', {
        chat_id: chatId,
        text: `${caption}:\n\n${payload.text ?? ''}`,
      });
    }

    if (!bytes) return { messageId: null, failure: { permanent: false, reason: 'sin archivo' } };

    const { method, field } = METHODS[payload.kind];
    const form = new FormData();

    form.append('chat_id', chatId);
    form.append('caption', caption);
    /*
     * Se suben los bytes en vez de pasarle la URL a Telegram.
     *
     * Por URL, Telegram tendría que poder alcanzar el almacenamiento desde
     * internet: en desarrollo es un MinIO en localhost, y en producción
     * obligaría a exponer el bucket. Subiendo, funciona igual en los dos sitios
     * y el archivo nunca deja de estar detrás de una URL firmada.
     */
    form.append(field, new Blob([bytes]), payload.fileName ?? payload.kind.toLowerCase());

    return this.call(method, form);
  }

  private async call(method: string, body: unknown): Promise<SendResult> {
    try {
      const response = await fetch(`${this.base}/${method}`, {
        ...(body instanceof FormData
          ? { body }
          : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
        method: 'POST',
        signal: AbortSignal.timeout(60_000),
      });

      const payload = (await response.json()) as {
        ok: boolean;
        description?: string;
        result?: { message_id?: number };
      };

      if (payload.ok) {
        return { messageId: String(payload.result?.message_id ?? ''), failure: null };
      }

      const reason = payload.description ?? 'Telegram rechazó el envío';

      return { messageId: null, failure: { permanent: isPermanent(reason), reason } };
    } catch (caught) {
      // Un corte de red no es culpa del horario: se reintenta en la siguiente.
      this.logger.warn(`Falló ${method} contra Telegram.`, caught);

      return { messageId: null, failure: { permanent: false, reason: 'no se pudo conectar' } };
    }
  }
}

function isPermanent(reason: string): boolean {
  const normalized = reason.toLowerCase();

  return PERMANENT.some((pattern) => normalized.includes(pattern));
}
