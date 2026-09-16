import type { UserId } from '../../shared/identifiers';

/** Cuánto vive el enlace de vinculación. Lo mismo que el de los destinatarios. */
export const LINK_CODE_TTL_MS = 24 * 60 * 60 * 1000;

export interface AccountChatSnapshot {
  readonly userId: UserId;
  readonly chatId: string | null;
  readonly linkCodeHash: string | null;
  readonly linkCodeExpiresAt: Date | null;
  readonly linkedAt: Date | null;
}

/**
 * El chat de Telegram del dueño de la cuenta.
 *
 * Es lo que hoy no existía: la aplicación conocía el chat de sus destinatarios
 * —otras personas— pero nunca el del propio usuario, y por eso los avisos al
 * dueño viven dentro de la aplicación en la tabla `notices`. Sin esto, `/habits`
 * no tendría forma de saber de quién son los hábitos que le están pidiendo.
 *
 * El código se guarda hasheado, igual que el de los destinatarios: quien lea la
 * tabla no puede colgarse su chat de una cuenta ajena.
 */
export class AccountChat {
  private constructor(private state: AccountChatSnapshot) {}

  static empty(userId: UserId): AccountChat {
    return new AccountChat({
      userId,
      chatId: null,
      linkCodeHash: null,
      linkCodeExpiresAt: null,
      linkedAt: null,
    });
  }

  static fromSnapshot(snapshot: AccountChatSnapshot): AccountChat {
    return new AccountChat(snapshot);
  }

  toSnapshot(): AccountChatSnapshot {
    return this.state;
  }

  get userId(): UserId {
    return this.state.userId;
  }

  get chatId(): string | null {
    return this.state.chatId;
  }

  get isLinked(): boolean {
    return this.state.linkedAt !== null && this.state.chatId !== null;
  }

  get codeExpiresAt(): Date | null {
    return this.state.linkCodeExpiresAt;
  }

  /**
   * Emite un código nuevo, que invalida el anterior.
   *
   * También sirve para volver a vincular: pedir un enlace suelta el chat que
   * hubiera, para que quien cambió de teléfono no se quede fuera de su propia
   * bitácora.
   */
  issueCode(hash: string, now: Date): void {
    this.state = {
      ...this.state,
      chatId: null,
      linkedAt: null,
      linkCodeHash: hash,
      linkCodeExpiresAt: new Date(now.getTime() + LINK_CODE_TTL_MS),
    };
  }

  codeIsUsable(now: Date): boolean {
    return (
      this.state.linkCodeHash !== null &&
      this.state.linkCodeExpiresAt !== null &&
      this.state.linkCodeExpiresAt.getTime() > now.getTime()
    );
  }

  /** Quema el código y se queda el chat. El código sale del mensaje, no del usuario. */
  link(chatId: string, now: Date): void {
    this.state = {
      ...this.state,
      chatId,
      linkedAt: now,
      linkCodeHash: null,
      linkCodeExpiresAt: null,
    };
  }

  unlink(): void {
    this.state = {
      ...this.state,
      chatId: null,
      linkedAt: null,
      linkCodeHash: null,
      linkCodeExpiresAt: null,
    };
  }
}
