import { describe, expect, it } from 'vitest';
import type { Clock } from '../../shared/clock';
import type { PlannedItem } from '../../shared/day-plan';
import type { LibraryId, RecipientId, ScheduleId, UserId } from '../../shared/identifiers';
import { PreviewDayPlan, SetFixedItems } from '../application/fixed-item-use-cases';
import type { ItemKind } from '../domain/item-kind';
import type {
  DailyWindow,
  FixedItem,
  FixedItemRepository,
  LibraryDirectory,
  OccurrencePlanner,
  ScheduleRepository,
} from '../domain/ports';
import { Schedule, type ScheduleFields } from '../domain/schedule';

const ANA = '11111111-1111-4111-8111-111111111111' as UserId;
const ALBUM = '22222222-2222-4222-8222-222222222222' as LibraryId;
const HORARIO = '77777777-7777-4777-8777-777777777777' as ScheduleId;

/** De 8:00 a 20:00. Fuera de esa franja no se puede clavar nada. */
const FIELDS: ScheduleFields = {
  weekdays: [1, 2, 3, 4, 5],
  startMinute: 480,
  endMinute: 1200,
  timezone: 'America/Bogota',
  senderName: null,
  kindFilter: null,
};

const FOTO = 'foto';
const CANCION = 'cancion';
/** Existe, pero en otra biblioteca. */
const AJENO = 'ajeno';

const NOW = new Date('2026-08-19T12:00:00.000Z');

class FakeLibraries implements LibraryDirectory {
  nameOf(): Promise<string | null> {
    return Promise.resolve('Álbum');
  }

  allows(): Promise<boolean> {
    return Promise.resolve(true);
  }

  planItemsOf(): Promise<PlannedItem[]> {
    return Promise.resolve([
      { id: FOTO, timesPerDay: 3, position: 1 },
      { id: CANCION, timesPerDay: 1, position: 2 },
    ]);
  }

  /** Solo devuelve lo que de verdad está en esta biblioteca. */
  itemsOf(
    _libraryId: LibraryId,
    itemIds: readonly string[],
  ): Promise<{ id: string; kind: ItemKind; label: string }[]> {
    const known: Record<string, ItemKind> = { [FOTO]: 'IMAGE', [CANCION]: 'AUDIO' };

    return Promise.resolve(
      itemIds
        .filter((id) => id in known)
        .map((id) => ({ id, kind: known[id] as ItemKind, label: id })),
    );
  }
}

class FakeFixed implements FixedItemRepository {
  rows: FixedItem[] = [];
  /** Cuántas veces se escribió, que es lo que delata una escritura de más. */
  writes = 0;

  listOf(): Promise<FixedItem[]> {
    return Promise.resolve(this.rows);
  }

  replace(_scheduleId: ScheduleId, items: readonly FixedItem[]): Promise<void> {
    this.writes += 1;
    this.rows = [...items];

    return Promise.resolve();
  }

  minutesOf(): Promise<number[]> {
    return Promise.resolve(this.rows.map((row) => row.minute));
  }
}

class FakeSchedules implements ScheduleRepository {
  saved = 0;

  constructor(private readonly schedule: Schedule | null) {}

  findOwned(): Promise<Schedule | null> {
    return Promise.resolve(this.schedule);
  }

  save(): Promise<void> {
    this.saved += 1;

    return Promise.resolve();
  }

  listOwnedBy(): Promise<Schedule[]> {
    return Promise.resolve([]);
  }

  add(): Promise<void> {
    return Promise.resolve();
  }

  remove(): Promise<void> {
    return Promise.resolve();
  }

  claimDue(): Promise<Schedule[]> {
    return Promise.resolve([]);
  }
}

function build({ nunca = false, ajeno = false }: { nunca?: boolean; ajeno?: boolean } = {}) {
  const created = Schedule.create({
    id: HORARIO,
    ownerId: ANA,
    libraryId: ALBUM,
    recipientId: '33333333-3333-4333-8333-333333333333' as RecipientId,
    fields: FIELDS,
    firstRunAt: NOW,
    now: NOW,
  });

  if (!created.ok) throw new Error('el horario de la prueba no es válido');

  // `ajeno`: el repositorio de verdad filtra por dueño en la consulta, así que
  // el horario de otra cuenta no vuelve. Aquí se dobla devolviendo nada.
  const schedules = new FakeSchedules(ajeno ? null : created.value);
  const fixed = new FakeFixed();

  // `nunca` es un horario cuyo plan no vuelve a caer nunca: es lo que
  // dispara `ScheduleNeverRuns`.
  const planner: OccurrencePlanner = {
    nextAfter: (_window: DailyWindow) => (nunca ? null : new Date('2026-08-20T13:00:00.000Z')),
  };

  const clock = { now: () => NOW } satisfies Clock;
  const libraries = new FakeLibraries();

  return {
    fixed,
    schedules,
    set: new SetFixedItems(schedules, fixed, libraries, planner, clock),
    preview: new PreviewDayPlan(schedules, fixed, libraries),
  };
}

describe('clavar envíos a una hora', () => {
  it('guarda las horas que caen dentro de la franja', async () => {
    const { set, fixed } = build();

    const result = await set.execute(ANA, HORARIO, [{ minute: 600, itemId: FOTO }]);

    expect(result.ok).toBe(true);
    expect(fixed.rows).toEqual([{ minute: 600, itemId: FOTO }]);
  });

  /*
   * Clavar algo a una hora en la que el horario no manda nada sería un envío
   * que no sale nunca, y desde la pantalla se vería guardado.
   */
  it('no acepta una hora anterior al inicio de la franja', async () => {
    const { set, fixed } = build();

    const result = await set.execute(ANA, HORARIO, [{ minute: 479, itemId: FOTO }]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('schedule.fixed_item_outside_window');
    expect(fixed.writes).toBe(0);
  });

  it('no acepta una hora posterior al fin de la franja', async () => {
    const { set, fixed } = build();

    const result = await set.execute(ANA, HORARIO, [{ minute: 1201, itemId: FOTO }]);

    expect(result.ok).toBe(false);
    expect(fixed.writes).toBe(0);
  });

  it('no acepta un archivo que no es de esa biblioteca', async () => {
    const { set, fixed } = build();

    const result = await set.execute(ANA, HORARIO, [{ minute: 600, itemId: AJENO }]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('schedule.fixed_item_not_in_library');
    expect(fixed.writes).toBe(0);
  });

  /*
   * Éste es el que motivó reordenar el caso de uso: el error llegaba después
   * de haber escrito, así que el usuario veía "no se pudo" y al reabrir el
   * diálogo se encontraba la hora puesta.
   */
  it('no deja nada escrito si el horario no volvería a correr', async () => {
    const { set, fixed, schedules } = build({ nunca: true });

    const result = await set.execute(ANA, HORARIO, [{ minute: 600, itemId: FOTO }]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('schedule.never_runs');
    expect(fixed.writes).toBe(0);
    expect(schedules.saved).toBe(0);
  });

  it('reemplaza la lista entera en vez de acumular', async () => {
    const { set, fixed } = build();

    await set.execute(ANA, HORARIO, [{ minute: 600, itemId: FOTO }]);
    await set.execute(ANA, HORARIO, [{ minute: 700, itemId: CANCION }]);

    expect(fixed.rows).toEqual([{ minute: 700, itemId: CANCION }]);
  });

  it('vaciar la lista es una operación válida', async () => {
    const { set, fixed } = build();

    await set.execute(ANA, HORARIO, [{ minute: 600, itemId: FOTO }]);
    const result = await set.execute(ANA, HORARIO, []);

    expect(result.ok).toBe(true);
    expect(fixed.rows).toEqual([]);
  });

  it('rehace la próxima vuelta al guardar', async () => {
    const { set, schedules } = build();

    await set.execute(ANA, HORARIO, [{ minute: 600, itemId: FOTO }]);

    // Sin esto, clavar algo a las 10:00 no despertaría al horario a las 10:00
    // hasta el siguiente disparo, y el primer envío fijo se perdería.
    expect(schedules.saved).toBe(1);
  });

  it('no deja clavar sobre el horario de otra cuenta', async () => {
    const { set, fixed } = build({ ajeno: true });
    const beto = '66666666-6666-4666-8666-666666666666' as UserId;

    const result = await set.execute(beto, HORARIO, [{ minute: 600, itemId: FOTO }]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('schedule.not_found');
    expect(fixed.writes).toBe(0);
  });
});

/**
 * Lo que la pantalla enseña, y que antes no existía: el día entero.
 *
 * La biblioteca de estas pruebas tiene dos archivos, `foto` y `cancion`, cada
 * uno una vez al día, en una franja de 8:00 a 20:00.
 */
describe('el día completo de un horario', () => {
  it('sin nada clavado son los cuatro envíos repartidos', async () => {
    const { preview } = build();

    const result = await preview.execute(ANA, HORARIO);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // `foto` tres veces y `cancion` una: cuatro envíos, ninguno clavado.
    expect(result.value).toHaveLength(4);
    expect(result.value.every((row) => !row.pinned)).toBe(true);
  });

  /*
   * El caso que trajo el cliente: los dos archivos clavados y además con sus
   * veces al día. La hora fija es **una** de esas veces, así que `foto` sigue
   * saliendo tres veces — antes se quedaba en una y no había forma de pedir más.
   */
  it('clavar los dos archivos no les quita sus veces al día', async () => {
    const { set, preview } = build();

    await set.execute(ANA, HORARIO, [
      { minute: 600, itemId: FOTO },
      { minute: 700, itemId: CANCION },
    ]);

    const result = await preview.execute(ANA, HORARIO);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toHaveLength(4);
    expect(result.value.filter((row) => row.itemId === FOTO)).toHaveLength(3);
    expect(result.value.filter((row) => row.itemId === CANCION)).toHaveLength(1);
  });

  /**
   * La chincheta es del minuto, no del archivo: `foto` tiene una hora fija y dos
   * repartidas, y solo la primera lleva marca.
   */
  it('marca como clavado solo el envío de la hora fija', async () => {
    const { set, preview } = build();

    await set.execute(ANA, HORARIO, [{ minute: 600, itemId: FOTO }]);

    const result = await preview.execute(ANA, HORARIO);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const suyos = result.value.filter((row) => row.itemId === FOTO);

    expect(suyos.filter((row) => row.pinned).map((row) => row.minute)).toEqual([600]);
    expect(suyos.filter((row) => !row.pinned)).toHaveLength(2);
  });

  it('sale ordenado por hora', async () => {
    const { set, preview } = build();

    await set.execute(ANA, HORARIO, [{ minute: 900, itemId: FOTO }]);

    const result = await preview.execute(ANA, HORARIO);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const minutos = result.value.map((row) => row.minute);

    expect(minutos).toEqual([...minutos].sort((left, right) => left - right));
  });

  it('trae la etiqueta y el tipo de cada archivo', async () => {
    const { preview } = build();

    const result = await preview.execute(ANA, HORARIO);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value[0]).toMatchObject({ label: FOTO, kind: 'IMAGE' });
  });

  it('no enseña el horario de otra cuenta', async () => {
    const { preview } = build({ ajeno: true });
    const beto = '66666666-6666-4666-8666-666666666666' as UserId;

    const result = await preview.execute(beto, HORARIO);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('schedule.not_found');
  });
});
