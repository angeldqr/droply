import { Logger } from '@nestjs/common';
import type { ChatAction } from '../../shared/habit-vote';
import type { InboundMessage, InboundPhoto } from '../../shared/journal-inbox';

/*
 * Lo que entra, con la forma que ya declara `shared/journal-inbox`.
 *
 * Se reexporta en vez de copiarse: eran dos parejas de tipos idénticas —una acá
 * y otra allá— y la copia solo servía para que un día se separaran.
 */
export type IncomingMessage = InboundMessage;
export type IncomingPhoto = InboundPhoto;

/** El toque de un botón, ya sin la envoltura de Telegram. */
export interface IncomingCallback {
  readonly chatId: string;
  /** Hay que acusarlo sí o sí, o el botón se queda girando en el teléfono. */
  readonly callbackId: string;
  /** El mensaje que llevaba el botón, para poder cambiarle el teclado. */
  readonly messageId: number | null;
  readonly data: string;
}

interface TelegramResponse<T> {
  readonly ok: boolean;
  readonly result?: T;
  readonly description?: string;
}

/**
 * El trozo de la API de Telegram que usa la aplicación.
 *
 * Sin SDK: son cuatro llamadas HTTP con cuerpo JSON, y una librería para eso
 * traería su propio ciclo de vida, sus tipos y sus versiones a cambio de nada.
 */
export class TelegramApi {
  private readonly logger = new Logger(TelegramApi.name);
  private readonly base: string;

  constructor(botToken: string) {
    this.base = `https://api.telegram.org/bot${botToken}`;
  }

  /** Quién es el bot de verdad, según Telegram. Falla si el token no vale. */
  async whoAmI(): Promise<{ username: string }> {
    const me = await this.call<{ username?: string }>('getMe', {});

    return { username: me?.username ?? '' };
  }

  sendMessage(chatId: string, text: string): Promise<void> {
    return this.call<unknown>('sendMessage', { chat_id: chatId, text }).then(() => undefined);
  }

  /**
   * Espera hasta `timeoutSeconds` a que haya algo. Es una conexión abierta, no
   * un sondeo en bucle: sin novedades no consume nada más que el socket.
   */
  getUpdates(
    offset: number,
    timeoutSeconds: number,
  ): Promise<{ id: number; message: unknown; callback: unknown }[]> {
    return this.call<{ update_id: number; message?: unknown; callback_query?: unknown }[]>(
      'getUpdates',
      // `callback_query` no es opcional: sin él, los toques de los botones de un
      // plan de hábitos no llegan y Telegram no dice nada. Es el filtro que
      // importa en desarrollo, que es donde el bot va por sondeo.
      { offset, timeout: timeoutSeconds, allowed_updates: ['message', 'callback_query'] },
      (timeoutSeconds + 10) * 1000,
    ).then((updates) =>
      (updates ?? []).map((update) => ({
        id: update.update_id,
        message: update.message,
        callback: update.callback_query,
      })),
    );
  }

  /**
   * Acusa el toque de un botón.
   *
   * Hay que llamarlo siempre, incluso ante un dato que no reconocemos: hasta
   * que llega, el teléfono deja el botón con el reloj girando. `text` sale como
   * un aviso corto arriba del chat.
   */
  answerCallback(callbackId: string, text: string): Promise<void> {
    return this.call<unknown>('answerCallbackQuery', {
      callback_query_id: callbackId,
      text,
    }).then(() => undefined);
  }

  /**
   * Cambia el teclado de un mensaje ya enviado.
   *
   * Telegram no sabe deshabilitar un botón, así que una votación cerrada se
   * muestra dejando uno solo con la respuesta elegida. Un teclado vacío lo
   * quita del todo.
   */
  replaceKeyboard(
    chatId: string,
    messageId: number,
    buttons: readonly ChatAction[],
  ): Promise<void> {
    return this.call<unknown>('editMessageReplyMarkup', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: buttons.map((button) => [
          { text: button.label, callback_data: button.data },
        ]),
      },
    }).then(() => undefined);
  }

  /**
   * Deja los comandos en el menú del bot.
   *
   * Sin esto `/habits` existe pero nadie lo descubre: Telegram solo ofrece lo
   * que el bot declara, y quien no sepa el comando de memoria no lo va a usar.
   */
  setCommands(commands: readonly { command: string; description: string }[]): Promise<unknown> {
    return this.call('setMyCommands', { commands });
  }

  setWebhook(url: string, secretToken: string): Promise<unknown> {
    /*
     * Sin `drop_pending_updates`: los mensajes que se encolaron mientras el API
     * estaba caído son `/start` de gente esperando a vincularse, y tirarlos
     * significa que su enlace se perdió sin que nadie se entere.
     */
    return this.call('setWebhook', {
      url,
      secret_token: secretToken,
      // Igual que en el sondeo: sin `callback_query` los botones no responden.
      allowed_updates: ['message', 'callback_query'],
    });
  }

  deleteWebhook(): Promise<unknown> {
    return this.call('deleteWebhook', {});
  }

  private async call<T>(method: string, body: unknown, timeoutMs = 15_000): Promise<T | undefined> {
    const response = await fetch(`${this.base}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const payload = (await response.json()) as TelegramResponse<T>;

    if (!payload.ok) {
      // El token no se registra nunca: va en la URL, así que se nombra el
      // método y el motivo, y no la dirección completa.
      this.logger.warn(`Telegram rechazó ${method}: ${payload.description ?? 'sin motivo'}`);

      throw new Error(`Telegram rechazó ${method}`);
    }

    return payload.result;
  }
}

/**
 * De la carga cruda de Telegram a lo poco que hace falta.
 *
 * Devuelve `null` para cualquier cosa que no sea un mensaje de texto de un
 * chat: ediciones, entradas a grupos, encuestas. Un webhook público recibe lo
 * que sea, así que acá no se asume ninguna forma.
 */
export function parseIncoming(raw: unknown): IncomingMessage | null {
  if (typeof raw !== 'object' || raw === null) return null;

  const message = (raw as { message?: unknown }).message;
  if (typeof message !== 'object' || message === null) return null;

  const chat = (message as { chat?: unknown }).chat;
  if (typeof chat !== 'object' || chat === null) return null;

  const chatId = (chat as { id?: unknown }).id;
  if (typeof chatId !== 'number' && typeof chatId !== 'string') return null;

  const text = (message as { text?: unknown }).text;

  return {
    chatId: String(chatId),
    // El pie de foto cuenta como texto: quien manda una imagen con «45 min de
    // bici» debajo está contando lo mismo que si lo escribiera aparte.
    text: firstString([text, (message as { caption?: unknown }).caption]),
    photo: photoSizesOf((message as { photo?: unknown }).photo),
  };
}

/** Lado mayor mínimo de la miniatura: una celda de la rejilla en pantalla densa. */
const THUMB_MIN_SIDE = 600;

/**
 * La foto en su resolución más grande, y una mediana para las rejillas.
 *
 * Una foto llega como un arreglo de versiones. Se guarda la de lado mayor más
 * grande; la miniatura es la más chica que llegue a `THUMB_MIN_SIDE`, o la
 * grande si ninguna llega. Se ordena en vez de confiar en el orden en que
 * Telegram las manda, que no está documentado.
 */
function photoSizesOf(raw: unknown): IncomingPhoto | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const sizes = raw.flatMap((size: unknown) => {
    const { file_id, width, height } = (size ?? {}) as {
      file_id?: unknown;
      width?: unknown;
      height?: unknown;
    };

    if (typeof file_id !== 'string') return [];

    return [{ fileId: file_id, side: Math.max(Number(width) || 0, Number(height) || 0) }];
  });

  sizes.sort((left, right) => left.side - right.side);

  const largest = sizes.at(-1);

  if (!largest) return null;

  const thumb = sizes.find((size) => size.side >= THUMB_MIN_SIDE) ?? largest;

  return { fileId: largest.fileId, thumbFileId: thumb.fileId };
}

function firstString(values: readonly unknown[]): string | null {
  for (const value of values) if (typeof value === 'string' && value.length > 0) return value;

  return null;
}

/**
 * De la carga cruda al toque de un botón, o `null` si el update no lo es.
 *
 * Va aparte de `parseIncoming` y no en un tipo unión: hay tres sitios que
 * llaman —el webhook, el sondeo y los tests— y ninguno gana nada teniendo que
 * desempaquetar. Un webhook público recibe lo que sea, así que acá no se asume
 * ninguna forma.
 */
export function parseCallback(raw: unknown): IncomingCallback | null {
  if (typeof raw !== 'object' || raw === null) return null;

  const query = (raw as { callback_query?: unknown }).callback_query;
  if (typeof query !== 'object' || query === null) return null;

  const callbackId = (query as { id?: unknown }).id;
  const data = (query as { data?: unknown }).data;

  if (typeof callbackId !== 'string' || typeof data !== 'string') return null;

  const message = (query as { message?: unknown }).message;
  if (typeof message !== 'object' || message === null) return null;

  const chat = (message as { chat?: unknown }).chat;
  if (typeof chat !== 'object' || chat === null) return null;

  const chatId = (chat as { id?: unknown }).id;
  if (typeof chatId !== 'number' && typeof chatId !== 'string') return null;

  const messageId = (message as { message_id?: unknown }).message_id;

  return {
    chatId: String(chatId),
    callbackId,
    messageId: typeof messageId === 'number' ? messageId : null,
    data,
  };
}
