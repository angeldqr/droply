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
  Payload,
  ScheduleReader,
} from '../domain/ports';

/** Violación de índice único, tal como la nombra Postgres a través de Prisma. */
const UNIQUE_VIOLATION = 'P2002';

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

  async record(attempt: {
    scheduleId: string;
    itemId: string | null;
    occurrenceKey: string;
    occurredAt: Date;
    status: 'SENT' | 'FAILED' | 'SKIPPED';
    providerMessageId: string | null;
    error: string | null;
  }): Promise<boolean> {
    try {
      await this.prisma.deliveryAttempt.create({ data: { id: randomUUID(), ...attempt } });

      return true;
    } catch (caught) {
      /*
       * Ya había una anotación para esa ocurrencia.
       *
       * Puede ser otra réplica que se adelantó —y entonces acá no hay que
       * mandar nada— o esta misma vuelta completando el resultado del envío que
       * ya reservó. Los dos casos se resuelven igual: se actualiza el resultado
       * y se responde "ya estaba".
       */
      if (
        caught instanceof Prisma.PrismaClientKnownRequestError &&
        caught.code === UNIQUE_VIOLATION
      ) {
        await this.prisma.deliveryAttempt.update({
          where: { occurrenceKey: attempt.occurrenceKey },
          data: {
            status: attempt.status,
            itemId: attempt.itemId,
            providerMessageId: attempt.providerMessageId,
            error: attempt.error,
          },
        });

        return false;
      }

      throw caught;
    }
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
