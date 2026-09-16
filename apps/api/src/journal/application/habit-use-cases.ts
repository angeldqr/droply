import type { Clock } from '../../shared/clock';
import type { DomainError } from '../../shared/domain-error';
import {
  type HabitEntryId,
  HabitId,
  type IdGenerator,
  type UserId,
} from '../../shared/identifiers';
import { err, ok, type Result } from '../../shared/result';
import { EntryNotFound, HabitNotFound, TooManyHabits } from '../domain/errors';
import { Habit, MAX_PER_ACCOUNT } from '../domain/habit';
import type { EntryRepository, HabitRepository, JournalPhotos, StoredPhoto } from '../domain/ports';

/** Lo que la pantalla muestra de un hábito. */
export interface HabitRow {
  readonly id: string;
  readonly name: string;
  readonly position: number;
  readonly entryCount: number;
  readonly lastEntryAt: Date | null;
}

/** Una anotación con sus fotos ya firmadas. */
export interface EntryRow {
  readonly id: string;
  readonly note: string | null;
  readonly photos: readonly { id: string; url: string | null; thumbUrl: string | null }[];
  readonly openedAt: Date;
  readonly closedAt: Date | null;
}

export class CreateHabit {
  constructor(
    private readonly habits: HabitRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(ownerId: UserId, name: string): Promise<Result<Habit, DomainError>> {
    if ((await this.habits.countOwnedBy(ownerId)) >= MAX_PER_ACCOUNT) {
      return err(new TooManyHabits(MAX_PER_ACCOUNT));
    }

    const last = await this.habits.lastPositionOf(ownerId);

    const habit = Habit.create({
      id: HabitId.from(this.ids.generate()),
      ownerId,
      name,
      // Al final de la lista, que es donde el usuario espera ver lo que acaba
      // de crear. Un paso entero y no un promedio: no hay vecino de la derecha.
      position: (last ?? 0) + 1,
      now: this.clock.now(),
    });

    if (!habit.ok) return habit;

    await this.habits.add(habit.value);

    return ok(habit.value);
  }
}

export class RenameHabit {
  constructor(private readonly habits: HabitRepository) {}

  async execute(
    ownerId: UserId,
    habitId: HabitId,
    name: string,
  ): Promise<Result<Habit, DomainError>> {
    const habit = await this.habits.findOwned(habitId, ownerId);

    if (!habit) return err(new HabitNotFound());

    const renamed = habit.rename(name);

    if (!renamed.ok) return renamed;

    await this.habits.save(habit);

    return ok(habit);
  }
}

/**
 * Borra el hábito con toda su bitácora, y los archivos con ella.
 *
 * Es lo que el usuario espera al borrar algo suyo: si quisiera guardar el
 * historial habría archivado. Los objetos del almacenamiento se quitan primero
 * porque la fila se los lleva por cascada y después ya no sabríamos cuáles eran.
 */
export class DeleteHabit {
  constructor(
    private readonly habits: HabitRepository,
    private readonly entries: EntryRepository,
    private readonly photos: JournalPhotos,
  ) {}

  async execute(ownerId: UserId, habitId: HabitId): Promise<Result<void, DomainError>> {
    const habit = await this.habits.findOwned(habitId, ownerId);

    if (!habit) return err(new HabitNotFound());

    const entries = await this.entries.listOf(habitId, ownerId);
    const byEntry = await this.entries.photosOf(
      ownerId,
      entries.map((entry) => entry.id),
    );

    for (const stored of byEntry.values()) {
      for (const photo of stored) await removeFiles(this.photos, photo);
    }

    await this.habits.remove(habitId, ownerId);

    return ok();
  }
}

export class DeleteEntry {
  constructor(
    private readonly entries: EntryRepository,
    private readonly photos: JournalPhotos,
  ) {}

  async execute(ownerId: UserId, entryId: HabitEntryId): Promise<Result<void, DomainError>> {
    const entry = await this.entries.findOwned(entryId, ownerId);

    if (!entry) return err(new EntryNotFound());

    const stored = (await this.entries.photosOf(ownerId, [entry.id])).get(entry.id) ?? [];

    for (const photo of stored) await removeFiles(this.photos, photo);

    await this.entries.remove(entryId, ownerId);

    return ok();
  }
}

/** Lo que las dos pantallas leen: la lista y la bitácora de un hábito. */
export class ReadJournal {
  constructor(
    private readonly habits: HabitRepository,
    private readonly entries: EntryRepository,
    private readonly photos: JournalPhotos,
    private readonly clock: Clock,
  ) {}

  async list(ownerId: UserId): Promise<HabitRow[]> {
    const [habits, stats] = await Promise.all([
      this.habits.listOwnedBy(ownerId),
      this.habits.statsOf(ownerId),
    ]);

    return habits.map((habit) => {
      const snapshot = habit.toSnapshot();
      const seen = stats.get(habit.id);

      return {
        id: snapshot.id,
        name: snapshot.name,
        position: snapshot.position,
        entryCount: seen?.count ?? 0,
        lastEntryAt: seen?.lastAt ?? null,
      };
    });
  }

  async entriesOf(ownerId: UserId, habitId: HabitId): Promise<Result<EntryRow[], DomainError>> {
    const habit = await this.habits.findOwned(habitId, ownerId);

    if (!habit) return err(new HabitNotFound());

    const rows = await this.entries.listOf(habitId, ownerId);
    const byEntry = await this.entries.photosOf(
      ownerId,
      rows.map((entry) => entry.id),
    );
    const now = this.clock.now();

    return ok(
      await Promise.all(
        rows.map(async (entry) => {
          const snapshot = entry.toSnapshot();

          return {
            id: snapshot.id,
            note: snapshot.note,
            photos: await this.signed(byEntry.get(snapshot.id) ?? []),
            openedAt: snapshot.openedAt,
            /*
             * Una anotación caducada se enseña como cerrada, aunque en la base
             * su `closed_at` siga vacío. El cierre es perezoso —se hace cuando
             * llega el mensaje siguiente, que es cuando importa— y sin esto una
             * anotación de hace tres semanas se quedaría «En curso» para
             * siempre en la pantalla. La fecha que se da es la de lo último que
             * llegó, que es cuando de verdad dejó de crecer.
             */
            closedAt: snapshot.closedAt ?? (entry.hasGoneStale(now) ? snapshot.touchedAt : null),
          };
        }),
      ),
    );
  }

  /**
   * Firma los enlaces de las fotos.
   *
   * Uno que no se pueda firmar sale en `null` y la tarjeta lo dice, en vez de
   * tumbar la pantalla entera por un archivo que se perdió.
   */
  private async signed(
    stored: readonly StoredPhoto[],
  ): Promise<{ id: string; url: string | null; thumbUrl: string | null }[]> {
    return Promise.all(
      stored.map(async (photo) => ({
        id: photo.id,
        url: await this.photos.linkTo(photo.storageKey).catch(() => null),
        thumbUrl:
          photo.thumbKey === null
            ? null
            : await this.photos.linkTo(photo.thumbKey).catch(() => null),
      })),
    );
  }
}

/** La foto y su miniatura, si la tiene. */
async function removeFiles(photos: JournalPhotos, photo: StoredPhoto): Promise<void> {
  await photos.remove(photo.storageKey);

  if (photo.thumbKey !== null) await photos.remove(photo.thumbKey);
}
