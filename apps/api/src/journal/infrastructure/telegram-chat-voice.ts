import { Logger } from '@nestjs/common';
import type { ChatVoice } from '../domain/ports';

/** Lo que tarda como mucho una llamada al bot. Bajar una foto puede ir lento. */
const TIMEOUT_MS = 30_000;

/**
 * La voz de la bitácora en el chat.
 *
 * Es el cuarto cliente de Telegram del repositorio, y por la misma razón que
 * los otros tres: un contexto no importa la infraestructura de otro, y esto son
 * cuatro llamadas HTTP, no una pieza que valga la pena compartir. A diferencia
 * del de `recipients`, este sí sabe mandar un teclado en un mensaje **nuevo** y
 * bajar un archivo.
 *
 * ponytail: con un quinto cliente toca mudarlos a `platform/telegram`, igual
 * que pasó con el de S3 cuando la bitácora fue el tercero que lo necesitaba.
 *
 * Todo falla en silencio a propósito. Lo que el usuario contó ya está guardado
 * cuando esto corre; que el acuse no salga es molesto, pero tirar el manejo del
 * mensaje haría que Telegram lo reintentara durante horas.
 */
export class TelegramChatVoice implements ChatVoice {
  private readonly logger = new Logger(TelegramChatVoice.name);
  private readonly api: string;
  private readonly files: string;

  constructor(botToken: string) {
    this.api = `https://api.telegram.org/bot${botToken}`;
    this.files = `https://api.telegram.org/file/bot${botToken}`;
  }

  async say(
    chatId: string,
    text: string,
    buttons: readonly { label: string; data: string }[] = [],
  ): Promise<void> {
    await this.call('sendMessage', {
      chat_id: chatId,
      text,
      /*
       * Un botón por fila. Con ocho hábitos, tres por fila parten los nombres
       * largos en dos líneas y quedan de anchos distintos; en columna se leen
       * igual en cualquier teléfono y la numeración se sigue de arriba abajo.
       */
      ...(buttons.length === 0
        ? {}
        : {
            reply_markup: {
              inline_keyboard: buttons.map((button) => [
                { text: button.label, callback_data: button.data },
              ]),
            },
          }),
    });
  }

  async acknowledge(callbackId: string): Promise<void> {
    // Sin texto: lo que hay que decir va en el mensaje que se manda después, y
    // el aviso flotante de Telegram tapa el chat sin aportar nada.
    await this.call('answerCallbackQuery', { callback_query_id: callbackId });
  }

  async clearKeyboard(chatId: string, messageId: number): Promise<void> {
    await this.call('editMessageReplyMarkup', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: [] },
    });
  }

  /**
   * Baja un archivo de Telegram.
   *
   * Son dos viajes y no uno: `getFile` da una ruta temporal y el archivo se pide
   * a un dominio distinto. La ruta vence en una hora, así que no se guarda.
   */
  async download(fileId: string): Promise<Uint8Array | null> {
    const file = await this.call<{ file_path?: string }>('getFile', { file_id: fileId });

    if (!file?.file_path) return null;

    try {
      const response = await fetch(`${this.files}/${file.file_path}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!response.ok) {
        this.logger.warn(`Telegram no entregó el archivo: ${response.status}`);

        return null;
      }

      return new Uint8Array(await response.arrayBuffer());
    } catch (caught) {
      this.logger.warn('No se pudo bajar un archivo de Telegram.', caught);

      return null;
    }
  }

  private async call<T>(method: string, body: unknown): Promise<T | null> {
    try {
      const response = await fetch(`${this.api}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      const payload = (await response.json()) as {
        ok: boolean;
        result?: T;
        description?: string;
      };

      if (!payload.ok) {
        // El token va en la URL, así que se nombra el método y el motivo, nunca
        // la dirección entera.
        this.logger.warn(`Telegram rechazó ${method}: ${payload.description ?? 'sin motivo'}`);

        return null;
      }

      return payload.result ?? null;
    } catch (caught) {
      this.logger.warn(`Falló ${method} contra Telegram.`, caught);

      return null;
    }
  }
}
