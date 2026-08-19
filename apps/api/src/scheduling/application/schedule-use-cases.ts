import type { Clock } from '../../shared/clock';
import type { InvalidInputError } from '../../shared/domain-error';
import {
  ScheduleId,
  type IdGenerator,
  type LibraryId,
  type RecipientId,
  type UserId,
} from '../../shared/identifiers';
import { err, ok, type Result } from '../../shared/result';
import {
  FixedItemOutsideWindow,
  RecipientNotInLibrary,
  RecipientNotLinked,
  ScheduleNeverRuns,
  ScheduleNotFound,
} from '../domain/errors';
import type {
  FixedItemRepository,
  LibraryDirectory,
  OccurrencePlanner,
  RecipientDirectory,
  ScheduleRepository,
} from '../domain/ports';
import { windowOf } from '../domain/daily-slots';
import { Schedule, type ScheduleFields } from '../domain/schedule';

/** El horario más los nombres que la pantalla necesita para poder mostrarlo. */
export interface ScheduleWithNames {
  readonly schedule: Schedule;
  readonly libraryName: string;
  readonly recipientLabel: string;
}

export interface ScheduleTarget {
  readonly libraryId: LibraryId;
  readonly recipientId: RecipientId;
}

export class ListSchedules {
  constructor(
    private readonly schedules: ScheduleRepository,
    private readonly libraries: LibraryDirectory,
    private readonly recipients: RecipientDirectory,
  ) {}

  async execute(ownerId: UserId): Promise<ScheduleWithNames[]> {
    const rows = await this.schedules.listOwnedBy(ownerId);
    const named: ScheduleWithNames[] = [];

    for (const schedule of rows) {
      // Los dos nombres salen de otros contextos, así que se piden por su
      // puerto. Si la biblioteca o el destinatario desaparecieron, la cascada
      // ya se llevó el horario: llegar acá con `null` sería un dato roto, y se
      // muestra sin nombre en vez de esconder la fila.
      const library = await this.libraries.nameOf(schedule.libraryId, ownerId);
      const recipient = await this.recipients.find(schedule.recipientId, ownerId);

      named.push({
        schedule,
        libraryName: library ?? 'Biblioteca borrada',
        recipientLabel: recipient?.label ?? 'Destinatario borrado',
      });
    }

    return named;
  }
}

export class CreateSchedule {
  constructor(
    private readonly schedules: ScheduleRepository,
    private readonly libraries: LibraryDirectory,
    private readonly recipients: RecipientDirectory,
    private readonly planner: OccurrencePlanner,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(
    ownerId: UserId,
    target: ScheduleTarget,
    fields: ScheduleFields,
  ): Promise<
    Result<
      Schedule,
      | ScheduleNotFound
      | RecipientNotLinked
      | RecipientNotInLibrary
      | ScheduleNeverRuns
      | InvalidInputError
    >
  > {
    // Biblioteca y destinatario se comprueban contra el dueño antes de nada:
    // un horario hacia lo ajeno no puede llegar a existir.
    if (!(await this.libraries.nameOf(target.libraryId, ownerId))) {
      return err(new ScheduleNotFound());
    }

    const recipient = await this.recipients.find(target.recipientId, ownerId);
    if (!recipient) return err(new ScheduleNotFound());

    // Sin vincular el bot no tiene permiso para escribirle, así que el horario
    // no podría enviar nada. Mejor decirlo al crearlo que fallar a las 8.
    if (!recipient.isLinked) return err(new RecipientNotLinked());

    // Y tiene que estar en la lista de esa biblioteca. Es la decisión que el
    // dueño tomó allá, y el horario no puede saltársela.
    if (!(await this.libraries.allows(target.libraryId, target.recipientId))) {
      return err(new RecipientNotInLibrary());
    }

    const now = this.clock.now();
    // La rejilla sale de lo que hay en la biblioteca: cada elemento aporta sus
    // horas según cuántas veces al día pida enviarse.
    const items = await this.libraries.planItemsOf(target.libraryId, fields.kindFilter);
    const firstRunAt = this.planner.nextAfter(windowOf(fields, items), fields.timezone, now);

    if (!firstRunAt) return err(new ScheduleNeverRuns());

    const schedule = Schedule.create({
      id: ScheduleId.from(this.ids.generate()),
      ownerId,
      libraryId: target.libraryId,
      recipientId: target.recipientId,
      fields,
      firstRunAt,
      now,
    });

    if (!schedule.ok) return schedule;

    await this.schedules.add(schedule.value);

    return ok(schedule.value);
  }
}

export class UpdateSchedule {
  constructor(
    private readonly schedules: ScheduleRepository,
    private readonly libraries: LibraryDirectory,
    private readonly planner: OccurrencePlanner,
    private readonly clock: Clock,
    private readonly fixed: FixedItemRepository,
  ) {}

  async execute(
    ownerId: UserId,
    scheduleId: ScheduleId,
    changes: Partial<ScheduleFields> & { active?: boolean },
  ): Promise<
    Result<
      Schedule,
      ScheduleNotFound | ScheduleNeverRuns | FixedItemOutsideWindow | InvalidInputError
    >
  > {
    const schedule = await this.schedules.findOwned(scheduleId, ownerId);
    if (!schedule) return err(new ScheduleNotFound());

    const fields: ScheduleFields = {
      weekdays: changes.weekdays ?? schedule.weekdays,
      startMinute: changes.startMinute ?? schedule.startMinute,
      endMinute: changes.endMinute ?? schedule.endMinute,
      timezone: changes.timezone ?? schedule.timezone,
      senderName: changes.senderName === undefined ? schedule.senderName : changes.senderName,
      kindFilter: changes.kindFilter === undefined ? schedule.kindFilter : changes.kindFilter,
    };

    /*
     * La fecha guardada se calculó con la regla vieja. Si cambió la regla o la
     * zona hay que rehacerla desde ahora: dejarla sería disparar a la hora que
     * el usuario acaba de cambiar.
     */
    const ruleChanged =
      fields.timezone !== schedule.timezone ||
      fields.startMinute !== schedule.startMinute ||
      fields.endMinute !== schedule.endMinute ||
      fields.weekdays.join() !== schedule.weekdays.join();

    const fixedMinutes = await this.fixed.minutesOf(scheduleId);

    /*
     * Estrechar la franja dejaría envíos fijos fuera de ella, y hay que decirlo
     * en vez de tirarlos en silencio: son horas que el dueño eligió a mano, y
     * perderlas por cambiar la franja se descubriría el día que no llegue nada.
     */
    if (fixedMinutes.some((minute) => minute < fields.startMinute || minute > fields.endMinute)) {
      return err(new FixedItemOutsideWindow());
    }

    const nextRunAt = ruleChanged
      ? this.planner.nextAfter(
          windowOf(
            fields,
            await this.libraries.planItemsOf(schedule.libraryId, fields.kindFilter),
            fixedMinutes,
          ),
          fields.timezone,
          this.clock.now(),
        )
      : schedule.nextRunAt;

    if (ruleChanged && !nextRunAt) return err(new ScheduleNeverRuns());

    const rescheduled = schedule.reschedule(fields, nextRunAt);
    if (!rescheduled.ok) return rescheduled;

    if (changes.active !== undefined) schedule.setActive(changes.active);

    await this.schedules.save(schedule);

    return ok(schedule);
  }
}

export class DeleteSchedule {
  constructor(private readonly schedules: ScheduleRepository) {}

  async execute(ownerId: UserId, scheduleId: ScheduleId): Promise<Result<void, ScheduleNotFound>> {
    const schedule = await this.schedules.findOwned(scheduleId, ownerId);
    if (!schedule) return err(new ScheduleNotFound());

    await this.schedules.remove(scheduleId, ownerId);

    return ok();
  }
}
