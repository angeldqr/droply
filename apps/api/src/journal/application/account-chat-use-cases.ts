import type { Clock } from '../../shared/clock';
import type { DomainError } from '../../shared/domain-error';
import type { UserId } from '../../shared/identifiers';
import { err, ok, type Result } from '../../shared/result';
import { AccountChat, LINK_CODE_TTL_MS } from '../domain/account-chat';
import { ChatTakenByAnotherAccount, EmailNotVerified } from '../domain/errors';
import type { AccountChatRepository, AccountStatus, LinkCodeFactory } from '../domain/ports';

/**
 * Emite el enlace con el que el dueño conecta su propio Telegram.
 *
 * Pedirlo **desvincula lo que hubiera**: es también la forma de cambiar de
 * teléfono, y quien lo pide ya decidió que el chat de antes no le sirve.
 *
 * Exige el correo confirmado, igual que crear un destinatario: vincular un chat
 * es abrirle al bot una vía hacia la cuenta.
 */
export class IssueChatLink {
  constructor(
    private readonly chats: AccountChatRepository,
    private readonly accounts: AccountStatus,
    private readonly codes: LinkCodeFactory,
    private readonly clock: Clock,
  ) {}

  async execute(ownerId: UserId): Promise<Result<{ code: string; expiresAt: Date }, DomainError>> {
    if (!(await this.accounts.hasVerifiedEmail(ownerId))) return err(new EmailNotVerified());

    const chat = (await this.chats.find(ownerId)) ?? AccountChat.empty(ownerId);
    const code = this.codes.create();
    const now = this.clock.now();

    chat.issueCode(code.hash, now);
    await this.chats.save(chat);

    // La fecha se calcula acá y no se lee de vuelta de la entidad: leerla
    // obligaba a tratar un `null` que `issueCode` acaba de descartar, y el
    // único sitio donde meterlo era un error que no venía a cuento.
    return ok({ code: code.value, expiresAt: new Date(now.getTime() + LINK_CODE_TTL_MS) });
  }
}

export class ReadChatLink {
  constructor(private readonly chats: AccountChatRepository) {}

  async execute(ownerId: UserId): Promise<{ linked: boolean; expiresAt: Date | null }> {
    const chat = await this.chats.find(ownerId);

    return { linked: chat?.isLinked ?? false, expiresAt: chat?.codeExpiresAt ?? null };
  }
}

export class UnlinkChat {
  constructor(private readonly chats: AccountChatRepository) {}

  async execute(ownerId: UserId): Promise<void> {
    const chat = await this.chats.find(ownerId);

    if (!chat) return;

    chat.unlink();
    await this.chats.save(chat);
  }
}

/**
 * Canjea el código que llega por `/start`.
 *
 * El `chat_id` sale **del mensaje que entrega Telegram**, nunca de algo que el
 * usuario declare: es la misma regla que sostiene la vinculación de los
 * destinatarios y no admite excepciones.
 */
export class LinkAccountChat {
  constructor(
    private readonly chats: AccountChatRepository,
    private readonly codes: LinkCodeFactory,
    private readonly clock: Clock,
  ) {}

  async execute(
    code: string,
    chatId: string,
  ): Promise<Result<AccountChat, DomainError> | 'NOT_MINE'> {
    const chat = await this.chats.findByCodeHash(this.codes.hash(code));

    /*
     * Que el código no sea de una cuenta **no es un error**: puede ser el de un
     * destinatario, que se atiende por otro camino. Se devuelve un tercer valor
     * en vez de un fallo para que quien llama sepa que tiene que seguir
     * probando en vez de contestarle al usuario que su enlace no sirve.
     */
    if (!chat) return 'NOT_MINE';

    const now = this.clock.now();

    if (!chat.codeIsUsable(now)) return 'NOT_MINE';

    const taken = await this.chats.findByChatId(chatId);

    // El índice único sobre `chat_id` lo impediría igual; acá se dice con
    // palabras en vez de reventar con un choque de índice.
    if (taken && taken.userId !== chat.userId) return err(new ChatTakenByAnotherAccount());

    chat.link(chatId, now);
    await this.chats.save(chat);

    return ok(chat);
  }
}
