import { Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import type { HandleTelegramMessage } from '../application/handle-telegram-message';
import { parseIncoming, type TelegramApi } from './telegram-api';

/** Cuánto espera cada `getUpdates` antes de volver vacío. */
const LONG_POLL_SECONDS = 30;

/** Tras un fallo de red no se reintenta en bucle cerrado. */
const RETRY_DELAY_MS = 5_000;

/**
 * Cómo llegan los mensajes del bot, que depende de si el API es alcanzable
 * desde internet.
 *
 * Con `TELEGRAM_WEBHOOK_URL` configurada se registra el webhook y Telegram
 * empuja cada mensaje. Sin ella —o sea, en cualquier máquina de desarrollo—
 * Telegram no tiene a dónde llamar, así que se hace al revés: el proceso abre
 * una conexión larga contra `getUpdates` y espera. Las dos puertas terminan en
 * el mismo caso de uso.
 *
 * El webhook se borra explícitamente al pasar a sondeo: mientras haya uno
 * registrado, Telegram rechaza `getUpdates` y el bot quedaría mudo sin decir
 * por qué.
 */
export class TelegramConnection implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(TelegramConnection.name);
  private offset = 0;
  private running = false;

  constructor(
    private readonly api: TelegramApi,
    private readonly handler: HandleTelegramMessage,
    private readonly webhook: {
      url: string | undefined;
      secret: string;
      isProduction: boolean;
      botUsername: string;
    },
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // Lo primero es preguntarle a Telegram quién es este bot. Sin esto, un
    // token inválido solo se notaba como un aviso perdido en el bucle del
    // sondeo, y el enlace que se le manda a la gente apunta a un usuario que no
    // existe: el fallo aparecía en el teléfono de otra persona, no acá.
    if (!(await this.checkIdentity())) return;

    if (this.webhook.url) {
      await this.registerWebhook(this.webhook.url);

      return;
    }

    /*
     * El sondeo es una muleta de desarrollo, no un modo de operación.
     *
     * En el servidor puede haber más de una réplica del API, y cada una
     * abriría su propio `getUpdates` contra el mismo bot: Telegram le entrega a
     * una sola y las demás reciben 409, así que los mensajes se atenderían a
     * medias sin que nada lo diga. Falta la variable, se avisa y no se sondea.
     */
    if (this.webhook.isProduction) {
      this.logger.error(
        'Falta TELEGRAM_WEBHOOK_URL: el bot no va a recibir nada. En producción no se sondea.',
      );

      return;
    }

    await this.startPolling();
  }

  onApplicationShutdown(): void {
    this.running = false;
  }

  /**
   * Comprueba que el token sirva y que el usuario configurado sea el de verdad.
   *
   * El nombre importa tanto como el token: el enlace de vinculación se arma con
   * `TELEGRAM_BOT_USERNAME`, así que si ahí hay otro nombre, la gente abre un
   * `t.me` que no lleva a ninguna parte aunque el bot funcione perfectamente.
   */
  private async checkIdentity(): Promise<boolean> {
    let me: { username: string };

    try {
      me = await this.api.whoAmI();
    } catch {
      this.logger.error(
        'TELEGRAM_BOT_TOKEN no vale: Telegram lo rechaza. Crea un bot con @BotFather y pon su token en el .env. El bot queda apagado.',
      );

      return false;
    }

    if (me.username && me.username !== this.webhook.botUsername) {
      this.logger.error(
        `TELEGRAM_BOT_USERNAME dice "${this.webhook.botUsername}" pero el bot es "${me.username}". Los enlaces de vinculación no van a llevar a ninguna parte hasta que lo corrijas en el .env.`,
      );
    }

    this.logger.log(`Bot conectado como @${me.username}`);

    return true;
  }

  private async registerWebhook(url: string): Promise<void> {
    try {
      await this.api.setWebhook(url, this.webhook.secret);
      this.logger.log(`Bot escuchando por webhook en ${url}`);
    } catch {
      // Sin webhook el bot no recibe nada, pero el resto del API funciona: los
      // destinatarios ya vinculados siguen ahí y las bibliotecas también.
      this.logger.error('No se pudo registrar el webhook; el bot no va a recibir mensajes.');
    }
  }

  private async startPolling(): Promise<void> {
    try {
      await this.api.deleteWebhook();
    } catch {
      this.logger.warn('No se pudo borrar el webhook anterior; el sondeo puede fallar.');
    }

    this.running = true;
    this.logger.log('Bot escuchando por sondeo largo (sin TELEGRAM_WEBHOOK_URL).');

    // Suelto a propósito: el bucle vive lo que viva el proceso y no puede
    // retrasar el arranque del servidor.
    void this.loop();
  }

  private async loop(): Promise<void> {
    while (this.running) {
      try {
        const updates = await this.api.getUpdates(this.offset, LONG_POLL_SECONDS);

        for (const update of updates) {
          // El acuse va por el offset: el siguiente pedido confirma que este ya
          // se procesó, así que un fallo a mitad lo vuelve a traer.
          this.offset = update.id + 1;

          const message = parseIncoming({ message: update.message });
          if (message) await this.handler.execute(message);
        }
      } catch (caught) {
        if (!this.running) return;

        this.logger.warn('Se cortó el sondeo del bot; reintento en unos segundos.', caught);
        await new Promise((done) => setTimeout(done, RETRY_DELAY_MS));
      }
    }
  }
}
