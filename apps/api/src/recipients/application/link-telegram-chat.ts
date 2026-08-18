import type { Clock } from '../../shared/clock';
import { err, ok, type Result } from '../../shared/result';
import { ChatAlreadyLinked, LinkCodeInvalid } from '../domain/errors';
import type { Recipient } from '../domain/recipient';
import type { LinkCodeFactory, RecipientRepository } from '../domain/ports';

/**
 * Lo que llega del bot cuando alguien abre el enlace y aprieta Empezar.
 *
 * No se acepta ninguna otra forma de vincular. El `chat_id` sale del propio
 * mensaje que Telegram entrega, así que no hay manera de que un usuario declare
 * el chat de otra persona: sin ese mensaje el bot ni siquiera podría escribirle.
 */
export class LinkTelegramChat {
  constructor(
    private readonly recipients: RecipientRepository,
    private readonly codes: LinkCodeFactory,
    private readonly clock: Clock,
  ) {}

  async execute(
    code: string,
    chatId: string,
  ): Promise<Result<Recipient, LinkCodeInvalid | ChatAlreadyLinked>> {
    const recipient = await this.recipients.findByCodeHash(this.codes.hash(code));
    const now = this.clock.now();

    // Inexistente, vencido y ya usado responden lo mismo. Distinguirlos
    // convertiría el bot en un oráculo para probar códigos a ciegas.
    if (!recipient || !recipient.codeIsUsable(now)) return err(new LinkCodeInvalid());

    /*
     * La base tiene un índice único que impide dos veces el mismo chat en una
     * cuenta. Si se dejara saltar a él, el fallo saldría como 500 y Telegram
     * reintentaría la misma entrega durante horas. Acá se ve venir y se
     * responde con algo que la persona entiende.
     */
    if (await this.recipients.findLinkedChat(recipient.ownerId, chatId)) {
      return err(new ChatAlreadyLinked());
    }

    recipient.link(chatId, now);
    await this.recipients.save(recipient);

    return ok(recipient);
  }
}
