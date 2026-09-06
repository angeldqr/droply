import { Logger } from '@nestjs/common';
import type { CallbackResponder, ChannelGateway } from '../domain/ports';
import type { TelegramApi } from './telegram-api';

/**
 * Mandar es "lo mejor que se pueda" cuando el mensaje es un acuse.
 *
 * Si Telegram no contesta mientras se confirma una vinculación, la vinculación
 * ya está hecha y guardada: hacerla fallar por el acuse dejaría al destinatario
 * sin vincular por un problema que no era suyo. El envío programado de la fase 6
 * sí necesita saber si salió, y para eso registrará su propio intento.
 */
export class TelegramChannelGateway implements ChannelGateway, CallbackResponder {
  private readonly logger = new Logger(TelegramChannelGateway.name);

  constructor(private readonly api: TelegramApi) {}

  async send(externalId: string, text: string): Promise<void> {
    try {
      await this.api.sendMessage(externalId, text);
    } catch (caught) {
      this.logger.warn(`No se pudo responderle al chat ${externalId}.`, caught);
    }
  }

  async answer(callbackId: string, text: string): Promise<void> {
    try {
      await this.api.answerCallback(callbackId, text);
    } catch (caught) {
      // El acuse vence a los pocos segundos y no se puede reintentar. La
      // respuesta ya quedó anotada, que es lo que importa.
      this.logger.warn('No se pudo acusar el toque de un botón.', caught);
    }
  }

  async lock(chatId: string, messageId: number, label: string): Promise<void> {
    try {
      // El dato es inerte a propósito: `parseHabitAction` lo rechaza, así que
      // volver a tocar el botón no anota nada.
      await this.api.replaceKeyboard(chatId, messageId, [{ label, data: 'h:' }]);
    } catch (caught) {
      // Que el teclado se quede con los tres botones es feo, no grave: el
      // segundo toque choca contra la clave primaria de todas formas.
      this.logger.warn('No se pudo cerrar el teclado de una votación.', caught);
    }
  }
}
