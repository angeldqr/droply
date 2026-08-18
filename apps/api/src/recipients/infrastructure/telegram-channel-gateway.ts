import { Logger } from '@nestjs/common';
import type { ChannelGateway } from '../domain/ports';
import type { TelegramApi } from './telegram-api';

/**
 * Mandar es "lo mejor que se pueda" cuando el mensaje es un acuse.
 *
 * Si Telegram no contesta mientras se confirma una vinculación, la vinculación
 * ya está hecha y guardada: hacerla fallar por el acuse dejaría al destinatario
 * sin vincular por un problema que no era suyo. El envío programado de la fase 6
 * sí necesita saber si salió, y para eso registrará su propio intento.
 */
export class TelegramChannelGateway implements ChannelGateway {
  private readonly logger = new Logger(TelegramChannelGateway.name);

  constructor(private readonly api: TelegramApi) {}

  async send(externalId: string, text: string): Promise<void> {
    try {
      await this.api.sendMessage(externalId, text);
    } catch (caught) {
      this.logger.warn(`No se pudo responderle al chat ${externalId}.`, caught);
    }
  }
}
