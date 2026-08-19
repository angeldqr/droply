import type { Schedule as ScheduleRow } from '@prisma/client';
import type { PrismaService } from '../../platform/prisma/prisma.service';
import {
  LibraryId,
  RecipientId,
  ScheduleId,
  UserId,
  type ScheduleId as ScheduleIdType,
} from '../../shared/identifiers';
import type { ScheduleRepository } from '../domain/ports';
import { Schedule } from '../domain/schedule';

/**
 * Cuánto se adelanta un horario al tomarlo, antes de saber su próxima fecha
 * real. Si el proceso muere a mitad de vuelta, el horario vuelve a estar
 * vencido un minuto después en vez de quedarse detenido para siempre.
 */
const LEASE_MINUTES = 1;

export class PrismaScheduleRepository implements ScheduleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listOwnedBy(ownerId: UserId): Promise<Schedule[]> {
    const rows = await this.prisma.schedule.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map(toDomain);
  }

  async findOwned(id: ScheduleIdType, ownerId: UserId): Promise<Schedule | null> {
    const row = await this.prisma.schedule.findFirst({ where: { id, ownerId } });

    return row ? toDomain(row) : null;
  }

  async add(schedule: Schedule): Promise<void> {
    const snapshot = schedule.toSnapshot();

    await this.prisma.schedule.create({
      data: {
        id: snapshot.id,
        ownerId: snapshot.ownerId,
        libraryId: snapshot.libraryId,
        recipientId: snapshot.recipientId,
        weekdays: [...snapshot.weekdays],
        startMinute: snapshot.startMinute,
        endMinute: snapshot.endMinute,
        timezone: snapshot.timezone,
        senderName: snapshot.senderName,
        kindFilter: snapshot.kindFilter,
        active: snapshot.active,
        nextRunAt: snapshot.nextRunAt,
        lastRunAt: snapshot.lastRunAt,
        createdAt: snapshot.createdAt,
      },
    });
  }

  async save(schedule: Schedule): Promise<void> {
    const snapshot = schedule.toSnapshot();

    /*
     * `updateMany` y no `update` para poder filtrar tambien por dueño: la
     * entidad llega ya comprobada, pero la regla de la casa es que la consulta
     * lleve el dueño encima, y así un camino nuevo no puede saltársela.
     */
    await this.prisma.schedule.updateMany({
      where: { id: snapshot.id, ownerId: snapshot.ownerId },
      data: {
        weekdays: [...snapshot.weekdays],
        startMinute: snapshot.startMinute,
        endMinute: snapshot.endMinute,
        timezone: snapshot.timezone,
        senderName: snapshot.senderName,
        kindFilter: snapshot.kindFilter,
        active: snapshot.active,
        nextRunAt: snapshot.nextRunAt,
        lastRunAt: snapshot.lastRunAt,
      },
    });
  }

  async remove(id: ScheduleIdType, ownerId: UserId): Promise<void> {
    await this.prisma.schedule.deleteMany({ where: { id, ownerId } });
  }

  /**
   * Toma los vencidos y los deja tomados, todo dentro de una transacción.
   *
   * `FOR UPDATE SKIP LOCKED` es la pieza que permite más de una réplica: la
   * primera bloquea las filas y la segunda **se las salta** en vez de esperar,
   * así que cada horario vencido sale una sola vez y ninguna réplica queda
   * parada detrás de la otra.
   *
   * Al final se adelanta la fecha un minuto, como préstamo. La fecha buena la
   * escribe el caso de uso enseguida; el préstamo solo cubre el hueco entre una
   * cosa y la otra, para que un proceso que muere a mitad no deje el horario
   * congelado ni lo dispare en bucle.
   *
   * El `::int` del préstamo tampoco es adorno. Prisma manda cualquier número de
   * JavaScript como `bigint`, y `make_interval` solo tiene versión para `int`:
   * sin la conversión, Postgres responde que no existe ninguna función con esos
   * tipos y la transacción entera se deshace, así que no se toma ningún horario
   * y no sale ningún envío.
   */
  claimDue(now: Date, limit: number): Promise<Schedule[]> {
    return this.prisma.$transaction(async (tx) => {
      /*
       * `AT TIME ZONE 'UTC'` no es adorno: sin él, el tick no encuentra nada.
       *
       * La columna es `timestamp without time zone` y guarda UTC, que es como
       * Prisma escribe un `DateTime`. Pero un `Date` de JavaScript entra a la
       * consulta como `timestamptz`, y para comparar los dos Postgres convierte
       * la columna usando la zona de la sesión. Con la sesión en America/Bogotá,
       * las 11:00 guardadas se leen como las 16:00 UTC: el horario de las 6 de
       * la mañana solo parecía vencido a las 11, cinco horas tarde.
       *
       * Con la conversión explícita los dos lados son UTC y la zona de la
       * sesión deja de importar. Las consultas tipadas de Prisma nunca tuvieron
       * el problema, porque el motor sabe el tipo de la columna; esto solo pasa
       * en SQL crudo, y acá hace falta crudo por el `FOR UPDATE SKIP LOCKED`.
       */
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id
        FROM schedules
        WHERE active
          AND next_run_at IS NOT NULL
          AND next_run_at <= (${now} AT TIME ZONE 'UTC')
        ORDER BY next_run_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      `;

      if (locked.length === 0) return [];

      const ids = locked.map((row) => row.id);
      const rows = await tx.schedule.findMany({ where: { id: { in: ids } } });

      await tx.$executeRaw`
        UPDATE schedules
        SET next_run_at = next_run_at + make_interval(mins => ${LEASE_MINUTES}::int)
        WHERE id = ANY(${ids}::uuid[])
      `;

      return rows.map(toDomain);
    });
  }
}

function toDomain(row: ScheduleRow): Schedule {
  return Schedule.fromSnapshot({
    id: ScheduleId.from(row.id),
    ownerId: UserId.from(row.ownerId),
    libraryId: LibraryId.from(row.libraryId),
    recipientId: RecipientId.from(row.recipientId),
    weekdays: row.weekdays,
    startMinute: row.startMinute,
    endMinute: row.endMinute,
    timezone: row.timezone,
    senderName: row.senderName,
    kindFilter: row.kindFilter,
    active: row.active,
    nextRunAt: row.nextRunAt,
    lastRunAt: row.lastRunAt,
    createdAt: row.createdAt,
  });
}
