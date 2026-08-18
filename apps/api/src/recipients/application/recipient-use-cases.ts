import type { Clock } from '../../shared/clock';
import type { InvalidInputError } from '../../shared/domain-error';
import { RecipientId, type IdGenerator, type UserId } from '../../shared/identifiers';
import { err, ok, type Result } from '../../shared/result';
import {
  AccountNotVerified,
  RecipientNotFound,
  type RecipientAlreadyLinked,
} from '../domain/errors';
import { Recipient } from '../domain/recipient';
import type { AccountStatus, LinkCodeFactory, RecipientRepository } from '../domain/ports';

/**
 * Cuánto vive un código de vinculación.
 *
 * Una hora sería poco: el enlace se le manda a alguien por otro medio y esa
 * persona lo abre cuando puede. Una semana ya es un secreto olvidado en un
 * chat. Un día es el punto donde deja de ser un apuro sin volverse eterno.
 */
const CODE_TTL_MS = 24 * 60 * 60 * 1000;

/** El destinatario recién creado y el código en claro, que solo se ve acá. */
export interface IssuedRecipient {
  readonly recipient: Recipient;
  readonly code: string;
}

export class ListRecipients {
  constructor(private readonly recipients: RecipientRepository) {}

  execute(ownerId: UserId): Promise<Recipient[]> {
    return this.recipients.listOwnedBy(ownerId);
  }
}

export class CreateRecipient {
  constructor(
    private readonly recipients: RecipientRepository,
    private readonly accounts: AccountStatus,
    private readonly codes: LinkCodeFactory,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(
    ownerId: UserId,
    label: string,
  ): Promise<Result<IssuedRecipient, AccountNotVerified | InvalidInputError>> {
    // La puerta está acá y no en un guard de framework: es una regla del
    // negocio, y un guard la dejaría fuera de los tests del caso de uso.
    if (!(await this.accounts.hasVerifiedEmail(ownerId))) {
      return err(new AccountNotVerified());
    }

    const now = this.clock.now();
    const code = this.codes.create();

    const recipient = Recipient.create({
      id: RecipientId.from(this.ids.generate()),
      ownerId,
      label,
      channel: 'TELEGRAM',
      codeHash: code.hash,
      codeExpiresAt: new Date(now.getTime() + CODE_TTL_MS),
      now,
    });

    if (!recipient.ok) return recipient;

    await this.recipients.add(recipient.value);

    return ok({ recipient: recipient.value, code: code.value });
  }
}

export class RelinkRecipient {
  constructor(
    private readonly recipients: RecipientRepository,
    private readonly accounts: AccountStatus,
    private readonly codes: LinkCodeFactory,
    private readonly clock: Clock,
  ) {}

  async execute(
    ownerId: UserId,
    recipientId: RecipientId,
  ): Promise<
    Result<IssuedRecipient, RecipientNotFound | AccountNotVerified | RecipientAlreadyLinked>
  > {
    // La misma puerta que al crear. Un enlace nuevo es un invite vivo, así que
    // una cuenta que perdió la verificación no puede seguir emitiéndolos por la
    // puerta de atrás.
    if (!(await this.accounts.hasVerifiedEmail(ownerId))) {
      return err(new AccountNotVerified());
    }

    const recipient = await this.recipients.findOwned(recipientId, ownerId);
    if (!recipient) return err(new RecipientNotFound());

    const code = this.codes.create();
    const expiresAt = new Date(this.clock.now().getTime() + CODE_TTL_MS);

    const reissued = recipient.reissueCode(code.hash, expiresAt);
    if (!reissued.ok) return reissued;

    await this.recipients.save(recipient);

    return ok({ recipient, code: code.value });
  }
}

export class DeleteRecipient {
  constructor(private readonly recipients: RecipientRepository) {}

  async execute(
    ownerId: UserId,
    recipientId: RecipientId,
  ): Promise<Result<void, RecipientNotFound>> {
    const recipient = await this.recipients.findOwned(recipientId, ownerId);
    if (!recipient) return err(new RecipientNotFound());

    await this.recipients.remove(recipientId, ownerId);

    return ok();
  }
}
