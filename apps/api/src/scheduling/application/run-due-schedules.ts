import type { Clock } from '../../shared/clock';
import type { ScheduleId } from '../../shared/identifiers';
import type { OccurrenceSink } from '../../shared/occurrence-sink';
import { windowOf } from '../domain/daily-slots';
import type { LibraryDirectory, OccurrencePlanner, ScheduleRepository } from '../domain/ports';

/** Cuántos vencidos se atienden por vuelta. */
const BATCH = 50;

/** Un disparo que tocaba: qué horario y a qué hora le correspondía. */
export interface DueOccurrence {
  readonly scheduleId: ScheduleId;
  readonly occurredAt: Date;
  /** `scheduleId:occurredAt`, para que reintentar no envíe dos veces. */
  readonly idempotencyKey: string;
}

/**
 * El latido: una vuelta por minuto que busca lo vencido y lo adelanta.
 *
 * Un solo trabajo repetido, y no un temporizador por horario. Con miles de
 * horarios, un temporizador cada uno se vuelve inmanejable y además hay que
 * rehacerlos todos cada vez que cambia el horario de verano; una consulta por
 * índice sobre `next_run_at` no cambia de coste.
 *
 * La toma de filas es lo que hace seguro correr varias réplicas: el
 * repositorio bloquea y se salta lo que otro ya tomó, así que el mismo horario
 * no sale dos veces en la misma vuelta.
 *
 * Lo que hay que enviar no se decide acá: cada ocurrencia se le pasa al sumidero
 * —el contexto de envío— y este solo se ocupa del calendario.
 */
export class RunDueSchedules {
  constructor(
    private readonly schedules: ScheduleRepository,
    private readonly libraries: LibraryDirectory,
    private readonly planner: OccurrencePlanner,
    private readonly clock: Clock,
    private readonly sink: OccurrenceSink,
  ) {}

  async execute(): Promise<DueOccurrence[]> {
    const now = this.clock.now();
    const due = await this.schedules.claimDue(now, BATCH);
    const occurrences: DueOccurrence[] = [];

    for (const schedule of due) {
      // `claimDue` ya filtró por vencido, así que esto siempre tiene fecha; el
      // guardia está para no inventar una si algún día la consulta cambia.
      const occurredAt = schedule.nextRunAt;
      if (!occurredAt) continue;

      /*
       * La siguiente se calcula desde la ocurrencia y no desde `now`.
       *
       * Si el proceso estuvo caído dos horas, `now` ya pasó varias
       * repeticiones: calcular desde ahí las saltaría en silencio. Desde la
       * ocurrencia, la vuelta siguiente recoge la que falta, una por vez, y el
       * horario se pone al día solo.
       */
      /*
       * La rejilla se vuelve a leer en cada disparo, no se guarda.
       *
       * Cambia sola cada vez que alguien agrega un archivo a la biblioteca o
       * cambia cuántas veces al día quiere que salga, y con una rejilla
       * guardada habría que acordarse de recalcularla en todos esos sitios.
       */
      const times = await this.libraries.sendTimesOf(schedule.libraryId, schedule.kindFilter);

      const nextRunAt = this.planner.nextAfter(
        windowOf(schedule, times),
        schedule.timezone,
        occurredAt,
      );

      schedule.markRun(occurredAt, nextRunAt);
      await this.schedules.save(schedule);

      const idempotencyKey = `${schedule.id}:${occurredAt.toISOString()}`;

      /*
       * Se avisa después de haber adelantado la fecha, no antes.
       *
       * Si el envío falla, el horario ya quedó apuntando a la siguiente
       * ocurrencia y la vuelta próxima no repite esta. Al revés —avisar
       * primero— un fallo a mitad de camino dejaría el horario vencido y el
       * mismo envío saldría en bucle cada minuto.
       */
      await this.sink.emit({ scheduleId: schedule.id, occurredAt, key: idempotencyKey });

      occurrences.push({ scheduleId: schedule.id, occurredAt, idempotencyKey });
    }

    return occurrences;
  }
}
