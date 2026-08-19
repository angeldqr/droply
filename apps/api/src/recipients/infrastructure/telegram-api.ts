import { Logger } from '@nestjs/common';

/** Lo que interesa de un mensaje entrante, ya sin la envoltura de Telegram. */
export interface IncomingMessage {
  readonly chatId: string;
  readonly text: string | null;
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
  getUpdates(offset: number, timeoutSeconds: number): Promise<{ id: number; message: unknown }[]> {
    return this.call<{ update_id: number; message?: unknown }[]>(
      'getUpdates',
      { offset, timeout: timeoutSeconds, allowed_updates: ['message'] },
      (timeoutSeconds + 10) * 1000,
    ).then((updates) =>
      (updates ?? []).map((update) => ({ id: update.update_id, message: update.message })),
    );
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
      allowed_updates: ['message'],
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

  return { chatId: String(chatId), text: typeof text === 'string' ? text : null };
}
