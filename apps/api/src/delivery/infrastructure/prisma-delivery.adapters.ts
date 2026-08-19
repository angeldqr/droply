import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DateTime } from 'luxon';
import type { PrismaService } from '../../platform/prisma/prisma.service';
import { slotsOf } from '../../shared/daily-slots';
import type {
  DeliveryLog,
  DeliveryRecord,
  DispatchTarget,
  LibraryCatalog,
  Payload,
  ScheduleReader,
  SentBag,
} from '../domain/ports';
import type { Candidate } from '../domain/selection';

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
        strategy: true,
        kindFilter: true,
        startMinute: true,
        endMinute: true,
        timezone: true,
        owner: { select: { displayName: true } },
        recipient: { select: { externalId: true, verifiedAt: true } },
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
      strategy: row.strategy,
      kindFilter: row.kindFilter,
      startMinute: row.startMinute,
      endMinute: row.endMinute,
      timezone: row.timezone,
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

  async candidatesOf(target: DispatchTarget, occurredAt: Date): Promise<Candidate[]> {
    const rows = await this.prisma.libraryItem.findMany({
      where: {
        libraryId: target.libraryId,
        ...(target.kindFilter === null ? {} : { kind: target.kindFilter }),
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
      select: { id: true, position: true, kind: true, timesPerDay: true },
    });

    const minute = dayMinuteOf(occurredAt, target.timezone);

    // De todos los de la biblioteca, solo los que a esta hora les toca salir.
    return rows
      .filter((row) =>
        slotsOf(row.timesPerDay, target.startMinute, target.endMinute).includes(minute),
      )
      .map((row) => ({ id: row.id, position: row.position, kind: row.kind }));
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

export class PrismaSentBag implements SentBag {
  constructor(private readonly prisma: PrismaService) {}

  async idsOf(scheduleId: string): Promise<string[]> {
    const rows = await this.prisma.sentItem.findMany({
      where: { scheduleId },
      select: { itemId: true },
    });

    return rows.map((row) => row.itemId);
  }

  async add(scheduleId: string, itemId: string): Promise<void> {
    // Repetido no es un error: la bolsa es un conjunto, no un contador.
    await this.prisma.sentItem.createMany({
      data: [{ scheduleId, itemId }],
      skipDuplicates: true,
    });
  }

  async clear(scheduleId: string): Promise<void> {
    await this.prisma.sentItem.deleteMany({ where: { scheduleId } });
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
