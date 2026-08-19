import { describe, expect, it } from 'vitest';
import type { Clock } from '../../shared/clock';
import type { PlannedItem } from '../../shared/day-plan';
import type { IdGenerator, LibraryId, RecipientId, UserId } from '../../shared/identifiers';
import { CreateSchedule } from '../application/schedule-use-cases';
import type { ItemKind } from '../domain/item-kind';
import type {
  DailyWindow,
  LibraryDirectory,
  OccurrencePlanner,
  RecipientDirectory,
  ScheduleRepository,
} from '../domain/ports';
import type { Schedule, ScheduleFields } from '../domain/schedule';

const ANA = '11111111-1111-4111-8111-111111111111' as UserId;
const ALBUM = '22222222-2222-4222-8222-222222222222' as LibraryId;
/** Está en la lista de la biblioteca. */
const MAMA = '33333333-3333-4333-8333-333333333333' as RecipientId;
/** Es de la misma cuenta y está vinculado, pero esa biblioteca no le manda. */
const JEFE = '44444444-4444-4444-8444-444444444444' as RecipientId;

const FIELDS: ScheduleFields = {
  weekdays: [1, 2, 3, 4, 5],
  startMinute: 480,
  endMinute: 1200,
  timezone: 'America/Bogota',
  senderName: null,
  kindFilter: null,
};

class FakeLibraries implements LibraryDirectory {
  nameOf(_libraryId: LibraryId, ownerId: UserId): Promise<string | null> {
    // Solo Ana tiene la biblioteca; para cualquier otra cuenta no existe.
    return Promise.resolve(ownerId === ANA ? 'Álbum' : null);
  }

  allows(_libraryId: LibraryId, recipientId: RecipientId): Promise<boolean> {
    return Promise.resolve(recipientId === MAMA);
  }

  planItemsOf(_libraryId: LibraryId, _kindFilter: ItemKind | null): Promise<PlannedItem[]> {
    return Promise.resolve([{ id: 'foto', timesPerDay: 1, position: 1 }]);
  }

  itemsOf(
    _libraryId: LibraryId,
    itemIds: readonly string[],
  ): Promise<{ id: string; kind: ItemKind; label: string }[]> {
    return Promise.resolve(itemIds.map((id) => ({ id, kind: 'IMAGE', label: id })));
  }
}

class FakeRecipients implements RecipientDirectory {
  constructor(private readonly linked: boolean) {}

  find(
    recipientId: RecipientId,
    ownerId: UserId,
  ): Promise<{ label: string; isLinked: boolean } | null> {
    if (ownerId !== ANA) return Promise.resolve(null);

    return Promise.resolve({
      label: recipientId === MAMA ? 'Mamá' : 'Jefe',
      isLinked: this.linked,
    });
  }
}

class CollectingSchedules implements ScheduleRepository {
  readonly added: Schedule[] = [];

  listOwnedBy(): Promise<Schedule[]> {
    return Promise.resolve([]);
  }

  findOwned(): Promise<Schedule | null> {
    return Promise.resolve(null);
  }

  add(schedule: Schedule): Promise<void> {
    this.added.push(schedule);

    return Promise.resolve();
  }

  save(): Promise<void> {
    return Promise.resolve();
  }

  remove(): Promise<void> {
    return Promise.resolve();
  }

  claimDue(): Promise<Schedule[]> {
    return Promise.resolve([]);
  }
}

const NOW = new Date('2026-08-19T12:00:00.000Z');

const planner: OccurrencePlanner = {
  nextAfter: (_window: DailyWindow) => new Date('2026-08-20T13:00:00.000Z'),
};

function build(linked = true) {
  const schedules = new CollectingSchedules();
  let next = 0;
  const ids: IdGenerator = { generate: () => `55555555-5555-4555-8555-55555555555${next++}` };

  return {
    schedules,
    create: new CreateSchedule(
      schedules,
      new FakeLibraries(),
      new FakeRecipients(linked),
      planner,
      ids,
      { now: () => NOW } satisfies Clock,
    ),
  };
}

/**
 * La lista de destinatarios de una biblioteca es la decisión que el dueño tomó
 * allá, y el horario no puede saltársela: si pudiera, marcar quién recibe qué
 * no significaría nada y una foto acabaría en el chat equivocado.
 */
describe('crear un horario', () => {
  it('no acepta un destinatario que no está en la biblioteca', async () => {
    const { create, schedules } = build();

    const result = await create.execute(ANA, { libraryId: ALBUM, recipientId: JEFE }, FIELDS);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('schedule.recipient_not_in_library');
    expect(schedules.added).toHaveLength(0);
  });

  it('no acepta un destinatario sin vincular', async () => {
    const { create, schedules } = build(false);

    const result = await create.execute(ANA, { libraryId: ALBUM, recipientId: MAMA }, FIELDS);

    expect(result.ok).toBe(false);
    expect(schedules.added).toHaveLength(0);
  });

  it('no deja programar sobre la biblioteca de otra cuenta', async () => {
    const { create, schedules } = build();
    const beto = '66666666-6666-4666-8666-666666666666' as UserId;

    const result = await create.execute(beto, { libraryId: ALBUM, recipientId: MAMA }, FIELDS);

    expect(result.ok).toBe(false);
    expect(schedules.added).toHaveLength(0);
  });

  it('acepta el destinatario que sí está en la lista', async () => {
    const { create, schedules } = build();

    const result = await create.execute(ANA, { libraryId: ALBUM, recipientId: MAMA }, FIELDS);

    expect(result.ok).toBe(true);
    expect(schedules.added).toHaveLength(1);
  });
});
