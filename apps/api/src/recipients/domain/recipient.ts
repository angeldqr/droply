import { InvalidInputError } from '../../shared/domain-error';
import type { RecipientId, UserId } from '../../shared/identifiers';
import { err, ok, type Result } from '../../shared/result';
import { RecipientAlreadyLinked } from './errors';

export const LABEL_MAX_LENGTH = 40;

/** Hoy solo Telegram. El canal existe porque la fase 2 del producto trae otro. */
export type RecipientChannel = 'TELEGRAM';

export interface RecipientSnapshot {
  readonly id: RecipientId;
  readonly ownerId: UserId;
  readonly label: string;
  readonly channel: RecipientChannel;
  readonly externalId: string | null;
  readonly linkCodeHash: string | null;
  readonly linkCodeExpiresAt: Date | null;
  readonly verifiedAt: Date | null;
  readonly createdAt: Date;
}

/**
 * A quién le llegan los envíos.
 *
 * Nace pendiente y con un código de un solo uso. El `externalId` —el chat de
 * Telegram— no lo escribe nadie: aparece cuando esa persona abre el enlace y
 * aprieta Empezar, que es el único momento en que el bot tiene permiso para
 * escribirle.
 */
export class Recipient {
  private constructor(private state: RecipientSnapshot) {}

  static create(input: {
    id: RecipientId;
    ownerId: UserId;
    label: string;
    channel: RecipientChannel;
    codeHash: string;
    codeExpiresAt: Date;
    now: Date;
  }): Result<Recipient, InvalidInputError> {
    const label = input.label.trim();

    if (label.length === 0) {
      return err(new InvalidInputError('recipient.label_required', 'Ponle un nombre.'));
    }

    if (label.length > LABEL_MAX_LENGTH) {
      return err(
        new InvalidInputError(
          'recipient.label_too_long',
          `El nombre no puede pasar de ${LABEL_MAX_LENGTH} caracteres.`,
        ),
      );
    }

    return ok(
      new Recipient({
        id: input.id,
        ownerId: input.ownerId,
        label,
        channel: input.channel,
        externalId: null,
        linkCodeHash: input.codeHash,
        linkCodeExpiresAt: input.codeExpiresAt,
        verifiedAt: null,
        createdAt: input.now,
      }),
    );
  }

  static fromSnapshot(snapshot: RecipientSnapshot): Recipient {
    return new Recipient(snapshot);
  }

  get id(): RecipientId {
    return this.state.id;
  }

  get ownerId(): UserId {
    return this.state.ownerId;
  }

  get label(): string {
    return this.state.label;
  }

  get channel(): RecipientChannel {
    return this.state.channel;
  }

  get externalId(): string | null {
    return this.state.externalId;
  }

  get linkCodeExpiresAt(): Date | null {
    return this.state.linkCodeExpiresAt;
  }

  get verifiedAt(): Date | null {
    return this.state.verifiedAt;
  }

  get createdAt(): Date {
    return this.state.createdAt;
  }

  get isLinked(): boolean {
    return this.state.verifiedAt !== null && this.state.externalId !== null;
  }

  /** El código sigue sirviendo mientras no haya vencido y nadie lo haya usado. */
  codeIsUsable(now: Date): boolean {
    return (
      !this.isLinked &&
      this.state.linkCodeHash !== null &&
      this.state.linkCodeExpiresAt !== null &&
      this.state.linkCodeExpiresAt > now
    );
  }

  /** Un código nuevo cuando el anterior venció. El viejo deja de valer acá mismo. */
  reissueCode(codeHash: string, expiresAt: Date): Result<void, RecipientAlreadyLinked> {
    if (this.isLinked) return err(new RecipientAlreadyLinked());

    this.state = { ...this.state, linkCodeHash: codeHash, linkCodeExpiresAt: expiresAt };

    return ok();
  }

  /**
   * Ya habló con el bot: se guarda su chat y se quema el código.
   *
   * El código se borra en vez de marcarse usado porque no queda nada que
   * consultar de él: un destinatario vinculado no vuelve a estar pendiente, y
   * guardarlo solo dejaría un secreto vivo sin motivo.
   */
  link(externalId: string, now: Date): void {
    this.state = {
      ...this.state,
      externalId,
      verifiedAt: now,
      linkCodeHash: null,
      linkCodeExpiresAt: null,
    };
  }

  toSnapshot(): RecipientSnapshot {
    return this.state;
  }
}
