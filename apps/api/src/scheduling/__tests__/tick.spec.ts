import { describe, expect, it } from 'vitest';
import { FixedClock } from '../../shared/clock';
import type { PlannedItem } from '../../shared/day-plan';
import { LibraryId, RecipientId, ScheduleId, UserId } from '../../shared/identifiers';
import { RunDueSchedules } from '../application/run-due-schedules';
import type {
  FixedItemRepository,
  LibraryDirectory,
  OccurrencePlanner,
  ScheduleRepository,
} from '../domain/ports';
import { Schedule } from '../domain/schedule';
import { WindowOccurrencePlanner } from '../infrastructure/window-occurrence-planner';

const ana = UserId.from('00000000-0000-4000-8000-00000000aaaa');

class InMemorySchedules implements ScheduleRepository {
  readonly rows = new Map<string, Schedule>();
  /** Lo que ya tomó otra vuelta, como haría el `SKIP LOCKED` de la base. */
  private claimed = new Set<string>();

  listOwnedBy(): Promise<Schedule[]> {
    return Promise.resolve([...this.rows.values()]);
  }

  findOwned(id: ScheduleId): Promise<Schedule | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }

  add(schedule: Schedule): Promise<void> {
    this.rows.set(schedule.id, schedule);

    return Promise.resolve();
  }

  save(schedule: Schedule): Promise<void> {
    this.rows.set(schedule.id, schedule);
    this.claimed.delete(schedule.id);

    return Promise.resolve();
  }

  remove(id: ScheduleId): Promise<void> {
    this.rows.delete(id);

    return Promise.resolve();
  }

  claimDue(now: Date, limit: number): Promise<Schedule[]> {
    const due = [...this.rows.values()]
      .filter(
        (schedule) =>
          schedule.active &&
          schedule.nextRunAt !== null &&
          schedule.nextRunAt <= now &&
          !this.claimed.has(schedule.id),
      )
      .slice(0, limit);

    for (const schedule of due) this.claimed.add(schedule.id);

    return Promise.resolve(due);
  }
}

/** La biblioteca de mentira: solo importa cuántas veces al día pide cada cosa. */
class FakeLibraries implements LibraryDirectory {
  items: PlannedItem[] = [{ id: 'foto', timesPerDay: 1, position: 1 }];

  nameOf(): Promise<string | null> {
    return Promise.resolve('Fotos');
  }

  allows(): Promise<boolean> {
    return Promise.resolve(true);
  }

  planItemsOf(): Promise<PlannedItem[]> {
    return Promise.resolve(this.items);
  }

  itemsOf(): Promise<{ id: string; kind: 'AUDIO'; label: string }[]> {
    return Promise.resolve([]);
  }
}

/** Sin envíos fijos: la rejilla sale entera de los repartos. */
const sinFijos: FixedItemRepository = {
  listOf: () => Promise.resolve([]),
  replace: () => Promise.resolve(),
  minutesOf: () => Promise.resolve([]),
};

function build(startingAt: Date) {
  const schedules = new InMemorySchedules();
  const libraries = new FakeLibraries();
  const planner: OccurrencePlanner = new WindowOccurrencePlanner();
  const clock = new FixedClock(startingAt);

  // El sumidero de mentira solo apunta lo que le avisan: quién envía de verdad
  // es asunto del contexto de envío y acá no interesa.
  const emitted: string[] = [];
  const sink = {
    emit: (occurrence: { key: string }) => {
      emitted.push(occurrence.key);

      return Promise.resolve();
    },
  };

  return {
    schedules,
    libraries,
    clock,
    emitted,
    run: new RunDueSchedules(schedules, libraries, planner, clock, sink, sinFijos),
  };
}

/** Todos los días a las 8 en Bogotá, que en UTC son las 13:00. */
const DIARIO_8 = {
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  startMinute: 8 * 60,
  endMinute: 20 * 60,
};

function schedule(firstRunAt: Date, now: Date, weekdays = DIARIO_8.weekdays): Schedule {
  const created = Schedule.create({
    id: ScheduleId.from('00000000-0000-4000-8000-000000000001'),
    ownerId: ana,
    libraryId: LibraryId.from('00000000-0000-4000-8000-000000000002'),
    recipientId: RecipientId.from('00000000-0000-4000-8000-000000000003'),
    fields: {
      weekdays,
      startMinute: DIARIO_8.startMinute,
      endMinute: DIARIO_8.endMinute,
      timezone: 'America/Bogota',
      senderName: null,
      kindFilter: null,
    },
    firstRunAt,
    now,
  });

  if (!created.ok) throw new Error('no se creó el horario');

  return created.value;
}

describe('la vuelta del planificador', () => {
  it('no toma nada cuando todavía no vence', async () => {
    const now = new Date('2026-05-10T12:00:00Z');
    const world = build(now);

    await world.schedules.add(schedule(new Date('2026-05-11T13:00:00Z'), now));

    expect(await world.run.execute()).toHaveLength(0);
  });

  it('dispara lo vencido y deja la siguiente calculada', async () => {
    const now = new Date('2026-05-10T13:05:00Z');
    const world = build(now);
    const vencido = new Date('2026-05-10T13:00:00Z');

    await world.schedules.add(schedule(vencido, now));

    const due = await world.run.execute();

    expect(due).toHaveLength(1);
    expect(due[0]?.occurredAt).toEqual(vencido);
    // La clave lleva la ocurrencia, así que reintentar la misma vuelta no
    // podría contar como un envío distinto.
    expect(due[0]?.idempotencyKey).toContain('2026-05-10T13:00:00.000Z');

    const stored = [...world.schedules.rows.values()][0];

    expect(stored?.lastRunAt).toEqual(vencido);
    expect(stored?.nextRunAt?.toISOString()).toBe('2026-05-11T13:00:00.000Z');
  });

  it('se pone al día una ocurrencia por vuelta tras estar caído', async () => {
    /*
     * El proceso estuvo tres días apagado. Calcular la siguiente desde "ahora"
     * saltaría las tres repeticiones perdidas en silencio; calculándola desde
     * la ocurrencia, cada vuelta recoge una y el horario se pone al día solo.
     */
    const world = build(new Date('2026-05-13T14:00:00Z'));

    await world.schedules.add(
      schedule(new Date('2026-05-10T13:00:00Z'), new Date('2026-05-09T00:00:00Z')),
    );

    const primera = await world.run.execute();
    const segunda = await world.run.execute();

    expect(primera[0]?.occurredAt.toISOString()).toBe('2026-05-10T13:00:00.000Z');
    expect(segunda[0]?.occurredAt.toISOString()).toBe('2026-05-11T13:00:00.000Z');
  });

  it('respeta los días elegidos al calcular el siguiente', async () => {
    // Solo lunes. El 2026-05-11 es lunes; el siguiente cae siete días después.
    const now = new Date('2026-05-11T13:05:00Z');
    const world = build(now);

    await world.schedules.add(schedule(new Date('2026-05-11T13:00:00Z'), now, [1]));

    await world.run.execute();

    expect([...world.schedules.rows.values()][0]?.nextRunAt?.toISOString()).toBe(
      '2026-05-18T13:00:00.000Z',
    );
  });

  it('un archivo que pide tres envíos al día densifica la rejilla', async () => {
    /*
     * Franja de 8:00 a 20:00 en Bogotá, o sea de 13:00 a 01:00 UTC. Con un
     * archivo que pide tres envíos, la siguiente parada después de las 13:00 es
     * la del medio: las 14:00 locales, 19:00 UTC.
     */
    const now = new Date('2026-05-10T13:05:00Z');
    const world = build(now);

    world.libraries.items = [{ id: 'audio', timesPerDay: 3, position: 1 }];
    await world.schedules.add(schedule(new Date('2026-05-10T13:00:00Z'), now));

    await world.run.execute();

    expect([...world.schedules.rows.values()][0]?.nextRunAt?.toISOString()).toBe(
      '2026-05-10T19:00:00.000Z',
    );
  });

  it('un horario pausado no se dispara aunque esté vencido', async () => {
    const now = new Date('2026-05-10T13:05:00Z');
    const world = build(now);
    const pausado = schedule(new Date('2026-05-10T13:00:00Z'), now);

    pausado.setActive(false);
    await world.schedules.add(pausado);

    expect(await world.run.execute()).toHaveLength(0);
  });
});
