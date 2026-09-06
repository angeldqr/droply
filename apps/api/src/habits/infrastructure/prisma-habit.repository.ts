import type { HabitPlan as HabitPlanRow, HabitPlanLibrary } from '@prisma/client';
import type { PrismaService } from '../../platform/prisma/prisma.service';
import {
  HabitPlanId,
  LibraryId,
  RecipientId,
  UserId,
  type HabitPlanId as HabitPlanIdType,
  type RecipientId as RecipientIdType,
} from '../../shared/identifiers';
import type { CivilDay } from '../domain/civil-day';
import { HabitPlan } from '../domain/habit-plan';
import type { HabitPlanRepository, ScoredDay } from '../domain/ports';

/**
 * Los planes en Postgres.
 *
 * Dos cosas que no son evidentes y conviene tener presentes al tocar esto:
 *
 * - Las columnas de día son `date`, así que Prisma las devuelve como un `Date`
 *   a medianoche **UTC**. El dominio trabaja con `AAAA-MM-DD` pelado, y la
 *   traducción vive acá y solo acá. Leerlas con `getDate()` daría el día
 *   anterior en cualquier zona al oeste de Greenwich.
 * - `active` y `recipientId` de `habit_plan_libraries` no son campos de
 *   negocio: sostienen el índice único parcial sobre (biblioteca,
 *   destinatario) que impide que la misma biblioteca vaya dos veces a la misma
 *   persona. `active` se apaga al anular y al cerrar, que son las dos formas de
 *   que un plan deje de retener sus bibliotecas.
 */
export class PrismaHabitPlanRepository implements HabitPlanRepository {
  constructor(private readonly prisma: PrismaService) {}

  async add(plan: HabitPlan): Promise<void> {
    const snapshot = plan.toSnapshot();

    await this.prisma.habitPlan.create({
      data: {
        id: snapshot.id,
        ownerId: snapshot.ownerId,
        recipientId: snapshot.recipientId,
        name: snapshot.name,
        durationDays: snapshot.durationDays,
        timezone: snapshot.timezone,
        startOn: toDate(snapshot.startOn),
        endOn: toDate(snapshot.endOn),
        status: snapshot.status,
        scoredThrough: null,
        createdAt: snapshot.createdAt,
        habits: {
          create: snapshot.habits.map((habit) => ({
            libraryId: habit.libraryId,
            // Copiado del plan: es la mitad del índice único que impide que la
            // misma biblioteca vaya dos veces a la misma persona.
            recipientId: snapshot.recipientId,
            label: habit.label,
            active: true,
          })),
        },
      },
    });
  }

  async save(plan: HabitPlan): Promise<void> {
    const snapshot = plan.toSnapshot();
    const alive = snapshot.status === 'ACTIVE';

    await this.prisma.$transaction([
      this.prisma.habitPlan.update({
        where: { id: snapshot.id },
        data: {
          status: snapshot.status,
          scoredThrough: snapshot.scoredThrough === null ? null : toDate(snapshot.scoredThrough),
          closedAt: snapshot.closedAt,
          reportSentAt: snapshot.reportSentAt,
        },
      }),
      // Un plan que deja de estar en marcha suelta sus bibliotecas, y con eso
      // se libera el índice único que impedía usarlas en otro plan.
      this.prisma.habitPlanLibrary.updateMany({
        where: { planId: snapshot.id },
        data: { active: alive },
      }),
    ]);
  }

  async listOwnedBy(ownerId: UserId): Promise<HabitPlan[]> {
    const rows = await this.prisma.habitPlan.findMany({
      where: { ownerId },
      include: { habits: true },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map(toDomain);
  }

  async findOwned(id: HabitPlanIdType, ownerId: UserId): Promise<HabitPlan | null> {
    const row = await this.prisma.habitPlan.findFirst({
      where: { id, ownerId },
      include: { habits: true },
    });

    return row ? toDomain(row) : null;
  }

  librariesInUse(
    libraryIds: readonly LibraryId[],
    recipientId: RecipientIdType,
  ): Promise<{ libraryId: string; label: string }[]> {
    return this.prisma.habitPlanLibrary.findMany({
      where: { libraryId: { in: [...libraryIds] }, recipientId, active: true },
      select: { libraryId: true, label: true },
    });
  }

  /**
   * Los planes a los que ya se les venció un día.
   *
   * El corte lo hace Postgres con la zona de cada plan: `now AT TIME ZONE
   * timezone` da la hora local de esa fila, y de ahí sale el día en el que esa
   * persona está viviendo ahora mismo. Hacerlo en JavaScript obligaría a traer
   * todos los planes vivos cada minuto para descartar casi todos.
   *
   * `COALESCE(scored_through + 1, start_on)` es el primer día sin cerrar. Si
   * ese día es anterior al de hoy en su zona, ya terminó y toca contarlo.
   *
   * El `::timestamptz` es obligatorio y no adorno. `AT TIME ZONE` hace dos
   * cosas distintas según el tipo del lado izquierdo: sobre un instante lo
   * traduce a la hora de pared de esa zona —que es lo que hace falta—, y sobre
   * una hora de pared la interpreta *como si fuera* de esa zona y devuelve un
   * instante, que es justo lo contrario. Sin la conversión explícita el día
   * saldría corrido y los resúmenes llegarían a deshora, sin que nada avise.
   */
  async listDueForScoring(now: Date, limit: number): Promise<HabitPlan[]> {
    const due = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id
      FROM habit_plans
      WHERE status = 'ACTIVE'
        AND COALESCE(scored_through + 1, start_on)
            < ((${now})::timestamptz AT TIME ZONE timezone)::date
      ORDER BY start_on
      LIMIT ${limit}
    `;

    if (due.length === 0) return [];

    const rows = await this.prisma.habitPlan.findMany({
      where: { id: { in: due.map((row) => row.id) } },
      include: { habits: true },
    });

    return rows.map(toDomain);
  }

  /**
   * Escribe el día y avanza el plan, o no hace nada.
   *
   * La condición del `updateMany` es que `scored_through` siga donde estaba
   * cuando se leyó el plan. Es un bloqueo optimista y no un `SELECT FOR UPDATE`
   * a propósito: entre leer el plan y escribir el día hay que consultar los
   * envíos y las respuestas, y tener una transacción abierta todo ese rato es
   * peor que reintentar en la vuelta siguiente. Si otra réplica se adelantó,
   * la condición no encaja, se actualizan cero filas y quien llamó se entera.
   */
  async commitDay(input: {
    planId: HabitPlanIdType;
    previous: CivilDay | null;
    day: CivilDay;
    rows: readonly ScoredDay[];
  }): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const advanced = await tx.habitPlan.updateMany({
        where: {
          id: input.planId,
          status: 'ACTIVE',
          scoredThrough: input.previous === null ? null : toDate(input.previous),
        },
        data: { scoredThrough: toDate(input.day) },
      });

      if (advanced.count === 0) return false;

      if (input.rows.length > 0) {
        await tx.habitDayScore.createMany({
          data: input.rows.map((row) => ({
            planId: input.planId,
            libraryId: row.libraryId,
            day: toDate(row.day),
            sent: row.sent,
            answered: row.answered,
            earned: row.earned,
          })),
          // Nadie más pudo llegar acá —el avance de arriba es exclusivo—, pero
          // si un reintento repitiera la transacción entera, el día ya escrito
          // no puede tumbarla.
          skipDuplicates: true,
        });
      }

      return true;
    });
  }

  async findActiveForDelivery(deliveryId: string): Promise<{
    plan: HabitPlan;
    libraryId: string;
    chatId: string | null;
    occurredAt: Date;
  } | null> {
    const delivery = await this.prisma.deliveryAttempt.findUnique({
      where: { id: deliveryId },
      select: {
        occurredAt: true,
        schedule: {
          select: {
            libraryId: true,
            recipientId: true,
            recipient: { select: { externalId: true, verifiedAt: true } },
          },
        },
      },
    });

    if (!delivery) return null;

    const { libraryId, recipientId, recipient } = delivery.schedule;

    /*
     * El plan tiene que ser el de **esa** biblioteca hacia **ese**
     * destinatario, no cualquiera que contenga la biblioteca. Un plan que le
     * manda a otra persona no cuenta este envío, y sin la segunda condición un
     * toque desde el chat equivocado se anotaría en el plan de al lado.
     */
    const membership = await this.prisma.habitPlanLibrary.findFirst({
      where: {
        libraryId,
        active: true,
        plan: { status: 'ACTIVE', recipientId },
      },
      include: { plan: { include: { habits: true } } },
    });

    if (!membership) return null;

    return {
      plan: toDomain(membership.plan),
      libraryId,
      chatId: recipient.verifiedAt === null ? null : recipient.externalId,
      occurredAt: delivery.occurredAt,
    };
  }
}

function toDomain(row: HabitPlanRow & { habits: HabitPlanLibrary[] }): HabitPlan {
  return HabitPlan.fromSnapshot({
    id: HabitPlanId.from(row.id),
    ownerId: UserId.from(row.ownerId),
    recipientId: RecipientId.from(row.recipientId),
    name: row.name,
    durationDays: row.durationDays,
    timezone: row.timezone,
    startOn: toCivilDay(row.startOn),
    endOn: toCivilDay(row.endOn),
    status: row.status,
    scoredThrough: row.scoredThrough === null ? null : toCivilDay(row.scoredThrough),
    closedAt: row.closedAt,
    reportSentAt: row.reportSentAt,
    habits: row.habits.map((habit) => ({
      libraryId: LibraryId.from(habit.libraryId),
      label: habit.label,
    })),
    createdAt: row.createdAt,
  });
}

/**
 * De `date` a `AAAA-MM-DD`.
 *
 * Se lee en UTC y no con `getDate()`: Postgres devuelve un `date` como
 * medianoche UTC, y leerlo en la zona del servidor daría el día anterior en
 * cualquier sitio al oeste de Greenwich —o sea, en Colombia siempre—.
 */
export function toCivilDay(value: Date): CivilDay {
  return value.toISOString().slice(0, 10);
}

/** Y de vuelta: medianoche UTC, que es como Postgres guarda un `date`. */
export function toDate(day: CivilDay): Date {
  return new Date(`${day}T00:00:00.000Z`);
}
