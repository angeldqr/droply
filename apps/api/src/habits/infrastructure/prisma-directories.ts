import type { PrismaService } from '../../platform/prisma/prisma.service';
import type { LibraryId, RecipientId, UserId } from '../../shared/identifiers';
import type {
  DeliveryDirectory,
  LibraryDirectory,
  RecipientDirectory,
  ResponseStore,
  ScoreStore,
  ScoredDay,
  SentDelivery,
  StoredResponse,
} from '../domain/ports';
import { toCivilDay } from './prisma-habit.repository';

/**
 * Lo que `habits` necesita de los otros contextos, leído de la base.
 *
 * Un contexto no importa el dominio de otro, así que en vez de un puente de
 * módulos de Nest se consultan las tablas directamente, exactamente como hace
 * `scheduling/infrastructure/prisma-directories.ts`. El dueño va siempre dentro
 * del `where`, nunca como comprobación posterior.
 */
export class PrismaHabitLibraryDirectory implements LibraryDirectory {
  constructor(private readonly prisma: PrismaService) {}

  ownedAmong(
    ownerId: UserId,
    libraryIds: readonly LibraryId[],
  ): Promise<{ id: string; name: string; isVault: boolean }[]> {
    return this.prisma.library.findMany({
      where: { id: { in: [...libraryIds] }, ownerId },
      select: { id: true, name: true, isVault: true },
    });
  }
}

export class PrismaHabitRecipientDirectory implements RecipientDirectory {
  constructor(private readonly prisma: PrismaService) {}

  async find(
    recipientId: RecipientId,
    ownerId: UserId,
  ): Promise<{ label: string; chatId: string | null } | null> {
    const row = await this.prisma.recipient.findFirst({
      where: { id: recipientId, ownerId },
      select: { label: true, externalId: true, verifiedAt: true },
    });

    if (!row) return null;

    // Sin vincular no hay chat, aunque la columna traiga algo viejo.
    return { label: row.label, chatId: row.verifiedAt === null ? null : row.externalId };
  }

  async labelsOf(ownerId: UserId, recipientIds: readonly string[]): Promise<Map<string, string>> {
    const rows = await this.prisma.recipient.findMany({
      // El dueño va dentro del `where`, no en una comprobación posterior: es la
      // regla transversal del repositorio y no admite excepciones cómodas.
      where: { id: { in: [...new Set(recipientIds)] }, ownerId },
      select: { id: true, label: true },
    });

    return new Map(rows.map((row) => [row.id, row.label]));
  }

  async chatOf(ownerId: UserId, recipientId: RecipientId): Promise<string | null> {
    const row = await this.prisma.recipient.findFirst({
      where: { id: recipientId, ownerId },
      select: { externalId: true, verifiedAt: true },
    });

    if (!row || row.verifiedAt === null) return null;

    return row.externalId;
  }
}

export class PrismaDeliveryDirectory implements DeliveryDirectory {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Los envíos que llegaron de verdad en esa ventana.
   *
   * Solo `SENT`: lo que se saltó por falta de contenido o falló por la red no
   * puede engordar el denominador, o un mal día del servidor le bajaría el
   * porcentaje a alguien que sí cumplió.
   *
   * La ventana viene en UTC ya calculada desde la zona del plan, así que acá no
   * se vuelve a razonar sobre horas: el extremo `to` es exclusivo para que la
   * medianoche exacta caiga en un solo día y no en los dos.
   */
  async sentBetween(
    recipientId: RecipientId,
    libraryIds: readonly LibraryId[],
    from: Date,
    to: Date,
  ): Promise<SentDelivery[]> {
    const rows = await this.prisma.deliveryAttempt.findMany({
      where: {
        status: 'SENT',
        occurredAt: { gte: from, lt: to },
        schedule: { recipientId, libraryId: { in: [...libraryIds] } },
      },
      select: { id: true, schedule: { select: { libraryId: true } } },
    });

    return rows.map((row) => ({ deliveryId: row.id, libraryId: row.schedule.libraryId }));
  }
}

export class PrismaResponseStore implements ResponseStore {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Anota la respuesta, o dice que ese envío ya tenía una.
   *
   * `createMany` con `skipDuplicates` y no un `create` con try/catch: la
   * respuesta que interesa es "cuántas filas entraron", y así el choque contra
   * la clave primaria no viaja como excepción por media pila.
   */
  async record(response: {
    deliveryId: string;
    planId: string;
    libraryId: string;
    answer: 'DONE' | 'HALF' | 'MISSED';
    answeredAt: Date;
  }): Promise<boolean> {
    const written = await this.prisma.habitResponse.createMany({
      data: [response],
      skipDuplicates: true,
    });

    return written.count === 1;
  }

  async of(deliveryIds: readonly string[]): Promise<StoredResponse[]> {
    if (deliveryIds.length === 0) return [];

    const rows = await this.prisma.habitResponse.findMany({
      where: { deliveryId: { in: [...deliveryIds] } },
      select: { deliveryId: true, libraryId: true, answer: true },
    });

    return rows;
  }
}

export class PrismaScoreStore implements ScoreStore {
  constructor(private readonly prisma: PrismaService) {}

  async listOf(planId: string): Promise<ScoredDay[]> {
    const rows = await this.prisma.habitDayScore.findMany({
      where: { planId },
      orderBy: [{ day: 'asc' }],
    });

    return rows.map(toScored);
  }

  async ofPlans(planIds: readonly string[]): Promise<Map<string, ScoredDay[]>> {
    if (planIds.length === 0) return new Map();

    const rows = await this.prisma.habitDayScore.findMany({
      where: { planId: { in: [...planIds] } },
      orderBy: [{ day: 'asc' }],
    });

    const byPlan = new Map<string, ScoredDay[]>();

    for (const row of rows) {
      const list = byPlan.get(row.planId) ?? [];

      list.push(toScored(row));
      byPlan.set(row.planId, list);
    }

    return byPlan;
  }
}

function toScored(row: {
  libraryId: string;
  day: Date;
  sent: number;
  answered: number;
  earned: number;
}): ScoredDay {
  return {
    libraryId: row.libraryId,
    day: toCivilDay(row.day),
    sent: row.sent,
    answered: row.answered,
    earned: row.earned,
  };
}
