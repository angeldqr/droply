import type { Clock } from '../../shared/clock';
import type { InvalidInputError } from '../../shared/domain-error';
import type { ScheduleId, UserId } from '../../shared/identifiers';
import { err, ok, type Result } from '../../shared/result';
import { windowOf } from '../domain/daily-slots';
import {
  FixedItemKindFiltered,
  FixedItemNotInLibrary,
  FixedItemOutsideWindow,
  ScheduleNeverRuns,
  ScheduleNotFound,
} from '../domain/errors';
import type { ItemKind } from '../domain/item-kind';
import type {
  FixedItem,
  FixedItemRepository,
  LibraryDirectory,
  OccurrencePlanner,
  ScheduleRepository,
} from '../domain/ports';

/** Un envío fijo con el archivo ya resuelto, que es lo que la pantalla enseña. */
export interface FixedItemWithLabel extends FixedItem {
  readonly kind: ItemKind;
  readonly label: string;
}

export class ListFixedItems {
  constructor(
    private readonly schedules: ScheduleRepository,
    private readonly fixed: FixedItemRepository,
    private readonly libraries: LibraryDirectory,
  ) {}

  async execute(
    ownerId: UserId,
    scheduleId: ScheduleId,
  ): Promise<Result<FixedItemWithLabel[], ScheduleNotFound>> {
    const schedule = await this.schedules.findOwned(scheduleId, ownerId);
    if (!schedule) return err(new ScheduleNotFound());

    const rows = await this.fixed.listOf(scheduleId);
    if (rows.length === 0) return ok([]);

    const items = await this.libraries.itemsOf(
      schedule.libraryId,
      rows.map((row) => row.itemId),
    );
    const byId = new Map(items.map((item) => [item.id, item]));

    return ok(
      rows
        // Un archivo borrado se lleva su envío fijo por cascada, así que llegar
        // acá sin él sería un dato roto; se salta en vez de inventar un nombre.
        .filter((row) => byId.has(row.itemId))
        .map((row) => {
          const item = byId.get(row.itemId);

          return {
            minute: row.minute,
            itemId: row.itemId,
            kind: item?.kind ?? 'TEXT',
            label: item?.label ?? '',
          };
        })
        .sort((left, right) => left.minute - right.minute),
    );
  }
}

/**
 * Clava qué sale a qué hora, para un horario.
 *
 * Se reemplaza la lista entera y no se agrega de a uno: la pantalla ya tiene el
 * estado completo delante, y así mandar dos veces lo mismo deja el horario
 * igual en vez de duplicar nada.
 *
 * Después de guardar hay que rehacer la próxima fecha. La rejilla del horario
 * es el plan del día **más** las horas clavadas: sin recalcular, clavar algo a
 * las 7:15 no despertaría al horario a las 7:15 hasta el siguiente disparo, y
 * el primer envío fijo se perdería.
 */
export class SetFixedItems {
  constructor(
    private readonly schedules: ScheduleRepository,
    private readonly fixed: FixedItemRepository,
    private readonly libraries: LibraryDirectory,
    private readonly planner: OccurrencePlanner,
    private readonly clock: Clock,
  ) {}

  async execute(
    ownerId: UserId,
    scheduleId: ScheduleId,
    items: readonly FixedItem[],
  ): Promise<
    Result<
      void,
      | ScheduleNotFound
      | FixedItemOutsideWindow
      | FixedItemNotInLibrary
      | FixedItemKindFiltered
      | ScheduleNeverRuns
      | InvalidInputError
    >
  > {
    const schedule = await this.schedules.findOwned(scheduleId, ownerId);
    if (!schedule) return err(new ScheduleNotFound());

    const outside = items.some(
      (item) => item.minute < schedule.startMinute || item.minute > schedule.endMinute,
    );

    if (outside) return err(new FixedItemOutsideWindow());

    const ids = [...new Set(items.map((item) => item.itemId))];

    if (ids.length > 0) {
      // La consulta pregunta por la biblioteca del horario, así que un archivo
      // de otra biblioteca —o de otra cuenta— simplemente no vuelve.
      const known = await this.libraries.itemsOf(schedule.libraryId, ids);

      if (known.length !== ids.length) return err(new FixedItemNotInLibrary());

      if (schedule.kindFilter !== null) {
        const filter = schedule.kindFilter;

        if (known.some((item) => item.kind !== filter)) return err(new FixedItemKindFiltered());
      }
    }

    await this.fixed.replace(scheduleId, items);

    const planItems = await this.libraries.planItemsOf(schedule.libraryId, schedule.kindFilter);
    const nextRunAt = this.planner.nextAfter(
      windowOf(
        schedule,
        planItems,
        items.map((item) => item.minute),
      ),
      schedule.timezone,
      this.clock.now(),
    );

    if (!nextRunAt) return err(new ScheduleNeverRuns());

    schedule.retime(nextRunAt);
    await this.schedules.save(schedule);

    return ok();
  }
}
