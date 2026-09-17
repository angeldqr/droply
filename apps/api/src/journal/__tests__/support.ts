import { addDays } from '@reconectate/contracts';
import { FixedClock } from '../../shared/clock';
import type { InboundPhoto } from '../../shared/journal-inbox';
import {
  type HabitEntryId,
  HabitId,
  type PhotoId,
  UserId,
  type IdGenerator,
} from '../../shared/identifiers';
import {
  IssueChatLink,
  LinkAccountChat,
  ReadChatLink,
  UnlinkChat,
} from '../application/account-chat-use-cases';
import {
  CreateHabit,
  DeleteEntry,
  DeleteHabit,
  PauseHabit,
  ReadJournal,
  ResumeHabit,
  UpdateHabit,
} from '../application/habit-use-cases';
import { JournalConversation } from '../application/journal-conversation';
import { AccountChat } from '../domain/account-chat';
import type { HabitEntry } from '../domain/entry';
import type { Habit } from '../domain/habit';
import type {
  AccountChatRepository,
  AccountStatus,
  ChatVoice,
  EntryRepository,
  HabitRepository,
  JournalPhotos,
  LinkCode,
  LinkCodeFactory,
  DayCounts,
  StoredPhoto,
} from '../domain/ports';

export const ANA = UserId.from('11111111-1111-4111-8111-111111111111');
export const BETO = UserId.from('22222222-2222-4222-8222-222222222222');

/** El chat de Ana, ya vinculado en casi todos los casos. */
export const CHAT = '555';

export const AHORA = new Date('2026-09-16T15:00:00.000Z');

/** Un PNG de verdad: los primeros ocho bytes son su firma. */
export const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
]);

/** Una foto entrante con su miniatura, como la arma el parser. */
export function foto(fileId: string): InboundPhoto {
  return { fileId, thumbFileId: `${fileId}-min` };
}

/** Y algo que no es una imagen, para probar que se rechaza. */
export const BASURA = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);

class SequentialIds implements IdGenerator {
  private next = 0;

  generate(): string {
    this.next += 1;

    return `aaaaaaaa-aaaa-4aaa-8aaa-${String(this.next).padStart(12, '0')}`;
  }
}

/** Códigos predecibles, mismo contrato que el real. */
class FakeCodes implements LinkCodeFactory {
  private next = 0;

  create(): LinkCode {
    this.next += 1;

    return { value: `codigo-${this.next}`, hash: `hash:codigo-${this.next}` };
  }

  hash(value: string): string {
    return `hash:${value}`;
  }
}

export class InMemoryHabits implements HabitRepository {
  readonly rows = new Map<string, Habit>();

  add(habit: Habit): Promise<void> {
    this.rows.set(habit.id, habit);

    return Promise.resolve();
  }

  save(habit: Habit): Promise<void> {
    this.rows.set(habit.id, habit);

    return Promise.resolve();
  }

  findOwned(id: string, ownerId: UserId): Promise<Habit | null> {
    const habit = this.rows.get(id);

    // El dueño es parte de la búsqueda, igual que en el repositorio real.
    return Promise.resolve(habit && habit.ownerId === ownerId ? habit : null);
  }

  listOwnedBy(ownerId: UserId): Promise<Habit[]> {
    return Promise.resolve(
      [...this.rows.values()]
        .filter((habit) => habit.ownerId === ownerId)
        .sort((left, right) => left.toSnapshot().position - right.toSnapshot().position),
    );
  }

  countOwnedBy(ownerId: UserId): Promise<number> {
    return Promise.resolve([...this.rows.values()].filter((h) => h.ownerId === ownerId).length);
  }

  async lastPositionOf(ownerId: UserId): Promise<number | null> {
    const own = await this.listOwnedBy(ownerId);

    return own.at(-1)?.toSnapshot().position ?? null;
  }

  remove(id: string, ownerId: UserId): Promise<void> {
    const habit = this.rows.get(id);

    if (habit && habit.ownerId === ownerId) this.rows.delete(id);

    return Promise.resolve();
  }

  /** Los contadores solo los pinta la pantalla; acá no aportan nada. */
  statsOf(): Promise<Map<HabitId, { count: number; lastAt: Date }>> {
    return Promise.resolve(new Map<HabitId, { count: number; lastAt: Date }>());
  }

  /** Las pausas viven dentro del agregado, que ya está en el mapa. */
  savePauses(habit: Habit): Promise<void> {
    return this.save(habit);
  }

  /** La cuenta de los tests vive en UTC, igual que su reloj. */
  timezoneOf(): Promise<string> {
    return Promise.resolve('UTC');
  }
}

export class InMemoryEntries implements EntryRepository {
  readonly rows = new Map<string, HabitEntry>();
  readonly photos = new Map<string, StoredPhoto[]>();

  add(entry: HabitEntry): Promise<void> {
    const chatId = entry.toSnapshot().chatId;

    // El índice único parcial de la base: una sola abierta por chat.
    if ([...this.rows.values()].some((row) => row.isOpen && row.toSnapshot().chatId === chatId)) {
      return Promise.reject(new Error('unique constraint: habit_entries_una_abierta_por_chat'));
    }

    this.rows.set(entry.id, entry);

    return Promise.resolve();
  }

  /** Como la base, pero con la cuenta en UTC: el reloj de los tests lo está. */
  dayCountsOf(ownerId: UserId, now: Date, days: number): Promise<DayCounts> {
    const today = now.toISOString().slice(0, 10);
    const from = addDays(today, -(days - 1));
    const counts = new Map<HabitId, Map<string, number>>();

    for (const entry of this.rows.values()) {
      const day = entry.toSnapshot().openedAt.toISOString().slice(0, 10);

      if (entry.ownerId !== ownerId || entry.isEmpty || day < from || day > today) continue;

      const perDay = counts.get(entry.habitId) ?? new Map<string, number>();

      perDay.set(day, (perDay.get(day) ?? 0) + 1);
      counts.set(entry.habitId, perDay);
    }

    return Promise.resolve({ today, counts });
  }

  save(entry: HabitEntry): Promise<void> {
    this.rows.set(entry.id, entry);

    return Promise.resolve();
  }

  findOpenFor(chatId: string, ownerId: UserId): Promise<HabitEntry | null> {
    // El índice único parcial de la base, en miniatura: hay una o ninguna. Y el
    // dueño entra en la búsqueda, igual que en el repositorio real.
    const open = [...this.rows.values()].find(
      (entry) => entry.toSnapshot().chatId === chatId && entry.ownerId === ownerId && entry.isOpen,
    );

    return Promise.resolve(open ?? null);
  }

  listOf(habitId: string, ownerId: UserId): Promise<HabitEntry[]> {
    return Promise.resolve(
      [...this.rows.values()].filter(
        (entry) => entry.habitId === habitId && entry.ownerId === ownerId,
      ),
    );
  }

  findOwned(id: string, ownerId: UserId): Promise<HabitEntry | null> {
    const entry = this.rows.get(id);

    return Promise.resolve(entry && entry.ownerId === ownerId ? entry : null);
  }

  remove(id: string, ownerId: UserId): Promise<void> {
    const entry = this.rows.get(id);

    if (entry && entry.ownerId === ownerId) {
      this.rows.delete(id);
      this.photos.delete(id);
    }

    return Promise.resolve();
  }

  photosOf(
    ownerId: UserId,
    entryIds: readonly HabitEntryId[],
  ): Promise<Map<HabitEntryId, StoredPhoto[]>> {
    // El dueño filtra acá igual que en el `where` del repositorio real.
    const mias = entryIds.filter((id) => this.rows.get(id)?.ownerId === ownerId);

    return Promise.resolve(
      new Map(mias.flatMap((id) => (this.photos.has(id) ? [[id, this.photos.get(id) ?? []]] : []))),
    );
  }

  /** Devuelve cuántas hay, como la base: es lo que hace cumplir el tope. */
  addPhoto(input: {
    id: PhotoId;
    ownerId: UserId;
    entryId: HabitEntryId;
    storageKey: string;
    thumbKey: string | null;
    now: Date;
  }): Promise<number> {
    const entry = this.rows.get(input.entryId);

    if (entry?.ownerId !== input.ownerId || !entry.isOpen) return Promise.resolve(0);

    const list = this.photos.get(input.entryId) ?? [];

    list.push({ id: input.id, storageKey: input.storageKey, thumbKey: input.thumbKey });
    this.photos.set(input.entryId, list);

    // El repositorio real relee el recuento con `_count`; acá se hace lo mismo
    // sobre la misma instancia, o la anotación diría que no tiene ninguna.
    entry.countPhotos(list.length, input.now);

    return Promise.resolve(list.length);
  }

  /** La concatenación que en la base hace un `UPDATE` que no se puede pisar. */
  appendNote(id: HabitEntryId, ownerId: UserId, text: string, now: Date): Promise<void> {
    const entry = this.rows.get(id);

    if (entry?.ownerId === ownerId && entry.isOpen) entry.addNote(text, now);

    return Promise.resolve();
  }
}

export class InMemoryChats implements AccountChatRepository {
  readonly rows = new Map<string, AccountChat>();

  find(userId: UserId): Promise<AccountChat | null> {
    return Promise.resolve(this.rows.get(userId) ?? null);
  }

  findByCodeHash(codeHash: string): Promise<AccountChat | null> {
    const found = [...this.rows.values()].find(
      (chat) => chat.toSnapshot().linkCodeHash === codeHash,
    );

    return Promise.resolve(found ?? null);
  }

  findByChatId(chatId: string): Promise<AccountChat | null> {
    const found = [...this.rows.values()].find((chat) => chat.chatId === chatId);

    return Promise.resolve(found ?? null);
  }

  save(chat: AccountChat): Promise<void> {
    this.rows.set(chat.userId, chat);

    return Promise.resolve();
  }
}

class FakeAccounts implements AccountStatus {
  readonly verified = new Set<string>([ANA, BETO]);

  hasVerifiedEmail(userId: UserId): Promise<boolean> {
    return Promise.resolve(this.verified.has(userId));
  }
}

export class FakePhotos implements JournalPhotos {
  readonly objects = new Map<string, Uint8Array>();

  /** Cuántas fotos hay guardadas, sin contar sus miniaturas. */
  originals(): number {
    return [...this.objects.keys()].filter((key) => !key.endsWith('.min')).length;
  }

  put(key: string, bytes: Uint8Array): Promise<void> {
    this.objects.set(key, bytes);

    return Promise.resolve();
  }

  linkTo(key: string): Promise<string> {
    return Promise.resolve(`https://firmada/${key}`);
  }

  remove(key: string): Promise<void> {
    this.objects.delete(key);

    return Promise.resolve();
  }
}

/** Lo que el bot dijo y lo que se le pidió bajar. */
export class FakeVoice implements ChatVoice {
  readonly said: { chatId: string; text: string; buttons: { label: string; data: string }[] }[] =
    [];
  readonly acknowledged: string[] = [];
  readonly cleared: number[] = [];
  /** Lo que devuelve `download`. Se cambia para probar una foto mala. */
  bytes: Uint8Array | null = PNG;
  /** Archivos que no se pueden bajar, para probar una miniatura que falla. */
  readonly unreachable = new Set<string>();

  say(
    chatId: string,
    text: string,
    buttons: readonly { label: string; data: string }[] = [],
  ): Promise<void> {
    this.said.push({ chatId, text, buttons: [...buttons] });

    return Promise.resolve();
  }

  acknowledge(callbackId: string): Promise<void> {
    this.acknowledged.push(callbackId);

    return Promise.resolve();
  }

  clearKeyboard(_chatId: string, messageId: number): Promise<void> {
    this.cleared.push(messageId);

    return Promise.resolve();
  }

  download(fileId: string): Promise<Uint8Array | null> {
    return Promise.resolve(this.unreachable.has(fileId) ? null : this.bytes);
  }

  /** Lo último que dijo, que es casi siempre lo que el test mira. */
  last(): string {
    return this.said.at(-1)?.text ?? '';
  }
}

export function build(startingAt = AHORA) {
  const clock = new FixedClock(startingAt);
  const habits = new InMemoryHabits();
  const entries = new InMemoryEntries();
  const chats = new InMemoryChats();
  const accounts = new FakeAccounts();
  const photos = new FakePhotos();
  const voice = new FakeVoice();
  const codes = new FakeCodes();
  const ids = new SequentialIds();

  const linkChat = new LinkAccountChat(chats, codes, clock);

  return {
    clock,
    habits,
    entries,
    chats,
    accounts,
    photos,
    voice,
    createHabit: new CreateHabit(habits, ids, clock),
    updateHabit: new UpdateHabit(habits),
    pauseHabit: new PauseHabit(habits, clock),
    resumeHabit: new ResumeHabit(habits, clock),
    deleteHabit: new DeleteHabit(habits, entries, photos),
    deleteEntry: new DeleteEntry(entries, photos),
    read: new ReadJournal(habits, entries, photos, clock),
    issueLink: new IssueChatLink(chats, accounts, codes, clock),
    readLink: new ReadChatLink(chats),
    unlink: new UnlinkChat(chats),
    linkChat,
    bot: new JournalConversation(chats, habits, entries, photos, voice, linkChat, ids, clock),
  };
}

export type World = ReturnType<typeof build>;

/** Deja el chat de Ana vinculado, sin pasar por el enlace. */
export function chatVinculado(world: World, userId = ANA, chatId = CHAT): void {
  const chat = AccountChat.empty(userId);

  chat.issueCode('hash:lo-que-sea', world.clock.now());
  chat.link(chatId, world.clock.now());
  world.chats.rows.set(userId, chat);
}

/** Crea un hábito de Ana y devuelve su identificador. */
export async function unHabito(
  world: World,
  name: string,
  ownerId = ANA,
  goal: { dailyTarget?: number; activeDays?: number } = {},
): Promise<HabitId> {
  const created = await world.createHabit.execute(ownerId, { name, ...goal });

  if (!created.ok) throw created.error;

  return HabitId.from(created.value.id);
}
