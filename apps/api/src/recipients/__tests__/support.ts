import { FixedClock } from '../../shared/clock';
import { UserId, type IdGenerator } from '../../shared/identifiers';
import { HandleTelegramMessage } from '../application/handle-telegram-message';
import { LinkTelegramChat } from '../application/link-telegram-chat';
import {
  CreateRecipient,
  DeleteRecipient,
  ListRecipients,
  RelinkRecipient,
} from '../application/recipient-use-cases';
import type {
  AccountStatus,
  ChannelGateway,
  LinkCodeFactory,
  RecipientRepository,
} from '../domain/ports';
import type { Recipient } from '../domain/recipient';

class SequentialIds implements IdGenerator {
  private counter = 0;

  generate(): string {
    this.counter += 1;

    return `00000000-0000-4000-8000-${String(this.counter).padStart(12, '0')}`;
  }
}

/** Códigos predecibles, con el mismo contrato que el real: valor y hash. */
class FakeLinkCodes implements LinkCodeFactory {
  private counter = 0;

  create(): { value: string; hash: string } {
    this.counter += 1;
    const value = `codigo-${this.counter}`;

    return { value, hash: this.hash(value) };
  }

  hash(value: string): string {
    return `hash:${value}`;
  }
}

export class InMemoryRecipientRepository implements RecipientRepository {
  readonly rows = new Map<string, Recipient>();

  listOwnedBy(ownerId: UserId): Promise<Recipient[]> {
    return Promise.resolve(
      [...this.rows.values()].filter((recipient) => recipient.ownerId === ownerId),
    );
  }

  findOwned(id: string, ownerId: UserId): Promise<Recipient | null> {
    const recipient = this.rows.get(id);

    // El dueño es parte de la búsqueda, igual que en el repositorio real.
    return Promise.resolve(recipient?.ownerId === ownerId ? recipient : null);
  }

  findByCodeHash(codeHash: string): Promise<Recipient | null> {
    const found = [...this.rows.values()].find(
      (recipient) => recipient.toSnapshot().linkCodeHash === codeHash,
    );

    return Promise.resolve(found ?? null);
  }

  findLinkedChat(ownerId: UserId, externalId: string): Promise<Recipient | null> {
    const found = [...this.rows.values()].find(
      (recipient) =>
        recipient.ownerId === ownerId && recipient.isLinked && recipient.externalId === externalId,
    );

    return Promise.resolve(found ?? null);
  }

  add(recipient: Recipient): Promise<void> {
    this.rows.set(recipient.id, recipient);

    return Promise.resolve();
  }

  save(recipient: Recipient): Promise<void> {
    this.rows.set(recipient.id, recipient);

    return Promise.resolve();
  }

  remove(id: string, ownerId: UserId): Promise<void> {
    const recipient = this.rows.get(id);
    if (recipient?.ownerId === ownerId) this.rows.delete(id);

    return Promise.resolve();
  }
}

class FakeAccounts implements AccountStatus {
  readonly verified = new Set<string>();

  hasVerifiedEmail(userId: UserId): Promise<boolean> {
    return Promise.resolve(this.verified.has(userId));
  }
}

class FakeChannel implements ChannelGateway {
  readonly sent: { externalId: string; text: string }[] = [];

  send(externalId: string, text: string): Promise<void> {
    this.sent.push({ externalId, text });

    return Promise.resolve();
  }
}

export const ana = UserId.from('00000000-0000-4000-8000-00000000aaaa');
export const beto = UserId.from('00000000-0000-4000-8000-00000000bbbb');

export function buildRecipients(startingAt = new Date('2026-08-18T09:00:00.000Z')) {
  const recipients = new InMemoryRecipientRepository();
  const accounts = new FakeAccounts();
  const codes = new FakeLinkCodes();
  const channel = new FakeChannel();
  const ids = new SequentialIds();
  const clock = new FixedClock(startingAt);

  // Ana tiene el correo confirmado; Beto no, para poder probar la puerta.
  accounts.verified.add(ana);

  const link = new LinkTelegramChat(recipients, codes, clock);

  return {
    recipients,
    accounts,
    channel,
    clock,
    list: new ListRecipients(recipients),
    create: new CreateRecipient(recipients, accounts, codes, ids, clock),
    relink: new RelinkRecipient(recipients, accounts, codes, clock),
    remove: new DeleteRecipient(recipients),
    link,
    handle: new HandleTelegramMessage(link, channel),
  };
}
