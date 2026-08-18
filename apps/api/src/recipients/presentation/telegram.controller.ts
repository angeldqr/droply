import { timingSafeEqual } from 'node:crypto';
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Post,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ENV, type ApiEnv } from '../../platform/config/env.module';
import { Public } from '../../platform/http/public.decorator';
import { HandleTelegramMessage } from '../application/handle-telegram-message';
import { parseIncoming } from '../infrastructure/telegram-api';

/** La cabecera que Telegram repite en cada entrega, tal como se registró. */
const SECRET_HEADER = 'x-telegram-bot-api-secret-token';

@Controller('telegram')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(
    @Inject(ENV) private readonly env: ApiEnv,
    @Inject(HandleTelegramMessage) private readonly handler: HandleTelegramMessage,
  ) {}

  /**
   * La entrada del bot en producción.
   *
   * Abierta por fuerza —Telegram no tiene sesión— y por eso lo primero que hace
   * es comprobar el secreto que se registró junto con el webhook. Sin eso,
   * cualquiera que conociera la dirección podría mandar un `/start` con un
   * código robado y vincular el chat que quisiera.
   *
   * Siempre responde 200, incluso ante basura o ante un fallo nuestro: un código
   * distinto haría que Telegram reintentara la misma carga durante horas. Por
   * lo mismo queda fuera del limitador global, que respondería 429.
   */
  @Public()
  @SkipThrottle()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async receive(
    @Headers(SECRET_HEADER) secret: string | undefined,
    @Body() update: unknown,
  ): Promise<void> {
    if (!matches(secret, this.env.TELEGRAM_WEBHOOK_SECRET)) return;

    const message = parseIncoming(update);
    if (!message) return;

    try {
      await this.handler.execute(message);
    } catch (caught) {
      // El fallo queda en el log para poder mirarlo, pero la respuesta sigue
      // siendo 200: reintentar esto mismo no lo va a arreglar.
      this.logger.error('Falló el manejo de un mensaje del bot.', caught);
    }
  }
}

/**
 * Comparación de tiempo constante.
 *
 * Un `!==` corta en el primer carácter distinto, y esa diferencia de tiempo es
 * medible: con suficientes intentos se adivina el secreto carácter a carácter.
 * `timingSafeEqual` exige longitudes iguales, así que eso se comprueba antes y
 * por separado, porque la longitud no es lo que hay que proteger.
 */
function matches(received: string | undefined, expected: string): boolean {
  if (received === undefined) return false;

  const left = Buffer.from(received);
  const right = Buffer.from(expected);

  return left.length === right.length && timingSafeEqual(left, right);
}
