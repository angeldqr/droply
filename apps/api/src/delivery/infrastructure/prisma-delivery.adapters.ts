import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DateTime } from 'luxon';
import type { PrismaService } from '../../platform/prisma/prisma.service';
import { planOf } from '../../shared/day-plan';
import type {
  DeliveryLog,
  DeliveryRecord,
  DispatchTarget,
  LibraryCatalog,
  NoticeReader,
  NoticeRecord,
  NoticeWriter,
  Payload,
  PendingRetry,
  ScheduleReader,
} from '../domain/ports';
import type { DeliveryStatus } from '../domain/vocabulary';

/** Violación de índice único, tal como la nombra Postgres a través de Prisma. */
const UNIQUE_VIOLATION = 'P2002';

/** Lo que se aparta un reintento tomado, para que un proceso muerto no lo pierda. */
const LEASE_MINUTES = 1;

export class PrismaScheduleReader implements ScheduleReader {
  private readonly logger = new Logger(PrismaScheduleReader.name);

  constructor(private readonly prisma: PrismaService) {}

  async find(scheduleId: string): Promise<DispatchTarget | null> {
    const row = await this.prisma.schedule.findUnique({
      where: { id: scheduleId },
      select: {
        id: true,
        libraryId: true,
        ownerId: true,
        senderName: true,
        kindFilter: true,
        startMinute: true,
        endMinute: true,
        timezone: true,
        owner: { select: { displayName: true } },
        recipient: { select: { externalId: true, verifiedAt: true } },
        fixedItems: { select: { minute: true, itemId: true } },
      },
    });

    if (!row) return null;

    return {
      scheduleId: row.id,
      libraryId: row.libraryId,
      ownerId: row.ownerId,
      // Sin vincular no hay chat al que escribir, y se trata como tal.
      chatId: row.recipient.verifiedAt === null ? null : row.recipient.externalId,
      // El nombre del horario manda; si no tiene, firma la cuenta.
      senderName: row.senderName ?? row.owner.displayName,
      kindFilter: row.kindFilter,
      startMinute: row.startMinute,
      endMinute: row.endMinute,
      timezone: row.timezone,
      fixedItems: row.fixedItems,
    };
  }

  async deactivate(scheduleId: string, reason: string): Promise<void> {
    await this.prisma.schedule.update({
      where: { id: scheduleId },
      // Se pausa, no se borra: el dueño tiene que poder ver qué pasó y
      // reanudarlo cuando lo arregle.
      data: { active: false },
    });

    // El motivo no tiene columna: al dueño se le avisa por Telegram y acá queda
    // el rastro para quien opere el servidor.
    this.logger.warn({ scheduleId, reason }, 'Horario apagado por un fallo permanente');
  }
}

export class PrismaLibraryCatalog implements LibraryCatalog {
  constructor(private readonly prisma: PrismaService) {}

  async itemAt(target: DispatchTarget, occurredAt: Date): Promise<string | null> {
    const minute = dayMinuteOf(occurredAt, target.timezone);

    /*
     * Lo clavado manda, y se resuelve sin ir a la base: las horas reservadas
     * viajan con el objetivo. Si esta hora tiene dueño, no hay más que decidir.
     */
    const pinned = target.fixedItems.find((fixed) => fixed.minute === minute);

    if (pinned) return pinned.itemId;

    const rows = await this.prisma.libraryItem.findMany({
      where: {
        libraryId: target.libraryId,
        ...(target.kindFilter === null ? {} : { kind: target.kindFilter }),
        /*
         * Lo que tiene hora propia no entra en el plan.
         *
         * Si el audio de las 6 ocupara además un momento del reparto, el mismo
         * archivo llegaría más veces de las que su dueño pidió. Clavado
         * significa clavado: sale a su hora y solo a su hora.
         */
        ...(target.fixedItems.length === 0
          ? {}
          : { id: { notIn: target.fixedItems.map((fixed) => fixed.itemId) } }),
        // Un archivo a medio subir no se puede enviar. Los textos no tienen
        // subida, y por eso entran siempre.
        OR: [{ storageKey: null }, { mediaReadyAt: { not: null } }],
        /*
         * El baúl no sale hacia nadie, nunca.
         *
         * La guarda está acá, en la consulta que decide qué se envía, y no en
         * quien llama: así ningún camino nuevo puede saltársela por descuido.
         */
        library: { isVault: false },
      },
      select: { id: true, timesPerDay: true, position: true },
    });

    /*
     * El plan se rehace en cada disparo en vez de guardarse.
     *
     * Cambia solo cada vez que alguien agrega un archivo, lo quita o le cambia
     * las veces al día; con un plan guardado habría que acordarse de
     * recalcularlo en todos esos sitios, y el día que se olvidara uno el
     * horario mandaría lo que ya no corresponde sin decir nada.
     */
    const plan = planOf(rows, target.startMinute, target.endMinute);

    return plan.find((send) => send.minute === minute)?.itemId ?? null;
  }

  async payloadOf(itemId: string): Promise<Payload | null> {
    const row = await this.prisma.libraryItem.findUnique({
      where: { id: itemId },
      select: { id: true, kind: true, fileName: true, textContent: true, storageKey: true },
    });

    if (!row) return null;

    return {
      itemId: row.id,
      kind: row.kind,
      fileName: row.fileName,
      text: row.textContent,
      storageKey: row.storageKey,
    };
  }
}

export class PrismaDeliveryLog implements DeliveryLog {
  constructor(private readonly prisma: PrismaService) {}

  async reserve(attempt: {
    scheduleId: string;
    itemId: string | null;
    occurrenceKey: string;
    occurredAt: Date;
    status: DeliveryStatus;
    error: string | null;
  }): Promise<boolean> {
    try {
      await this.prisma.deliveryAttempt.create({ data: { id: randomUUID(), ...attempt } });

      return true;
    } catch (caught) {
      /*
       * Ya había una anotación para esa ocurrencia, así que es de otro.
       *
       * **No se toca la fila.** Quien la reservó primero es el dueño del envío,
       * y pisarle el resultado borraría lo que ya hubiera averiguado —el
       * identificador del mensaje, o que estaba esperando un reintento.
       */
      if (
        caught instanceof Prisma.PrismaClientKnownRequestError &&
        caught.code === UNIQUE_VIOLATION
      ) {
        return false;
      }

      throw caught;
    }
  }

  async settle(
    occurrenceKey: string,
    result: {
      status: DeliveryStatus;
      itemId?: string | null;
      providerMessageId?: string | null;
      error: string | null;
      retryCount?: number;
      nextAttemptAt?: Date | null;
    },
  ): Promise<void> {
    await this.prisma.deliveryAttempt.update({
      where: { occurrenceKey },
      data: {
        status: result.status,
        error: result.error,
        ...(result.itemId === undefined ? {} : { itemId: result.itemId }),
        ...(result.providerMessageId === undefined
          ? {}
          : { providerMessageId: result.providerMessageId }),
        ...(result.retryCount === undefined ? {} : { retryCount: result.retryCount }),
        ...(result.nextAttemptAt === undefined ? {} : { nextAttemptAt: result.nextAttemptAt }),
      },
    });
  }

  /**
   * Igual que el calendario toma sus horarios vencidos: bloquea las filas y se
   * salta las que otro proceso ya tenga, para que un reintento no salga dos
   * veces con más de una réplica.
   *
   * El `AT TIME ZONE 'UTC'` es obligatorio y no adorno: la columna es
   * `timestamp` sin zona y un `Date` entra como `timestamptz`, así que sin él
   * Postgres compararía usando la zona de la sesión y los reintentos vencerían
   * con horas de desfase.
   */
  claimDueRetries(now: Date, limit: number): Promise<PendingRetry[]> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id
        FROM delivery_attempts
        WHERE status = 'RETRYING'
          AND next_attempt_at IS NOT NULL
          AND next_attempt_at <= (${now} AT TIME ZONE 'UTC')
        ORDER BY next_attempt_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      `;

      if (locked.length === 0) return [];

      const ids = locked.map((row) => row.id);
      const rows = await tx.deliveryAttempt.findMany({
        where: { id: { in: ids } },
        select: {
          scheduleId: true,
          occurrenceKey: true,
          occurredAt: true,
          retryCount: true,
          itemId: true,
        },
      });

      /*
       * Se adelanta un minuto la hora del siguiente intento, como préstamo.
       *
       * Es el mismo arreglo que usa el calendario. La hora buena la escribe el
       * despacho enseguida; el préstamo solo cubre el hueco entre una cosa y la
       * otra, para que un proceso que muere a mitad no deje el reintento
       * disparándose cada minuto **ni desaparecido para siempre**, que es lo que
       * pasaría si acá se pusiera la hora en nulo.
       *
       * El `::int` no es adorno: Prisma manda los números como `bigint` y
       * `make_interval` solo tiene versión para `int`.
       */
      await tx.$executeRaw`
        UPDATE delivery_attempts
        SET next_attempt_at = next_attempt_at + make_interval(mins => ${LEASE_MINUTES}::int)
        WHERE id = ANY(${ids}::uuid[])
      `;

      // Un reintento sin elemento no puede existir: solo se llega a RETRYING
      // después de haber elegido uno. Si aparece, se deja pasar.
      return rows.flatMap((row) =>
        row.itemId === null
          ? []
          : [
              {
                scheduleId: row.scheduleId,
                occurrenceKey: row.occurrenceKey,
                occurredAt: row.occurredAt,
                retryCount: row.retryCount,
                itemId: row.itemId,
              },
            ],
      );
    });
  }

  async recent(ownerId: string, limit: number): Promise<DeliveryRecord[]> {
    const rows = await this.prisma.deliveryAttempt.findMany({
      where: { schedule: { ownerId } },
      orderBy: { occurredAt: 'desc' },
      take: limit,
      select: {
        id: true,
        scheduleId: true,
        status: true,
        error: true,
        occurredAt: true,
        schedule: {
          select: { library: { select: { name: true } }, recipient: { select: { label: true } } },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      scheduleId: row.scheduleId,
      libraryName: row.schedule.library.name,
      recipientLabel: row.schedule.recipient.label,
      status: row.status,
      error: row.error,
      occurredAt: row.occurredAt,
    }));
  }
}

/** En qué minuto del día cae ese instante, según la zona del horario. */
function dayMinuteOf(moment: Date, timezone: string): number {
  const local = DateTime.fromJSDate(moment, { zone: timezone });

  return local.isValid ? local.hour * 60 + local.minute : 0;
}

/**
 * Los avisos del dueño, dentro de la aplicación.
 *
 * Escribir y leer están en la misma clase porque son la misma tabla y dos
 * líneas cada uno; separarlos en dos adaptadores sería ceremonia. Los puertos
 * sí están separados: quien envía solo puede escribir.
 */
export class PrismaNotices implements NoticeWriter, NoticeReader {
  constructor(private readonly prisma: PrismaService) {}

  async write(ownerId: string, text: string): Promise<void> {
    await this.prisma.notice.create({ data: { id: randomUUID(), ownerId, text } });
  }

  async unreadOf(ownerId: string): Promise<NoticeRecord[]> {
    return this.prisma.notice.findMany({
      where: { ownerId, readAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, text: true, createdAt: true },
    });
  }

  async markRead(ownerId: string, noticeId: string): Promise<void> {
    // El dueño va en el `where`: nadie marca como leído el aviso de otro.
    await this.prisma.notice.updateMany({
      where: { id: noticeId, ownerId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
