import { ChatAlreadyLinked } from '../domain/errors';
import type { ChannelGateway } from '../domain/ports';
import type { LinkTelegramChat } from './link-telegram-chat';

/**
 * Qué contesta el bot. Es lo único que ve el destinatario de la aplicación, así
 * que habla en su idioma y no en el de la base de datos.
 */
const REPLIES = {
  linked: (label: string) =>
    `Listo. A partir de ahora vas a recibir acá lo que «${label}» te mande desde Droply.`,
  invalid:
    'Ese enlace ya no sirve o no es el tuyo. Pídele a quien te lo mandó que genere uno nuevo.',
  noCode:
    'Hola. Para recibir envíos necesitas abrir el enlace que te mandaron, que trae tu código de vinculación.',
  alreadyLinked: 'Ya estás recibiendo envíos de esta persona. No tienes que hacer nada más.',
} as const;

/**
 * Un mensaje entrante del bot, ya sin la envoltura de Telegram.
 *
 * Vive en `application` y no en el controlador porque hay dos puertas hacia
 * acá: el webhook en producción y el sondeo largo en desarrollo, donde Telegram
 * no puede alcanzar una dirección local. Las dos traducen la carga cruda a esta
 * forma y llaman a lo mismo, así que no hay dos versiones de la vinculación.
 */
export class HandleTelegramMessage {
  constructor(
    private readonly link: LinkTelegramChat,
    private readonly channel: ChannelGateway,
  ) {}

  async execute(message: { chatId: string; text: string | null }): Promise<void> {
    const code = startPayloadOf(message.text);

    if (code === null) {
      await this.channel.send(message.chatId, REPLIES.noCode);

      return;
    }

    const linked = await this.link.execute(code, message.chatId);

    if (linked.ok) {
      await this.channel.send(message.chatId, REPLIES.linked(linked.value.label));

      return;
    }

    await this.channel.send(
      message.chatId,
      linked.error instanceof ChatAlreadyLinked ? REPLIES.alreadyLinked : REPLIES.invalid,
    );
  }
}

/** `/start <codigo>` es lo único que el bot atiende por ahora. */
function startPayloadOf(text: string | null): string | null {
  if (!text) return null;

  const match = /^\/start(?:@\w+)?\s+(\S+)$/.exec(text.trim());

  return match?.[1] ?? null;
}
