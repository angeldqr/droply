import type { Clock } from '../../shared/clock';
import type { DomainError } from '../../shared/domain-error';
import {
  HabitPlanId,
  LibraryId,
  type RecipientId,
  type IdGenerator,
  type UserId,
} from '../../shared/identifiers';
import { err, ok, type Result } from '../../shared/result';
import { daysFrom, type CivilDay } from '../domain/civil-day';
import {
  HabitPlanNotFound,
  LibraryAlreadyInPlan,
  LibraryNotAvailable,
  RecipientNotLinked,
  VaultIsNotAHabit,
} from '../domain/errors';
import { HabitPlan, type PlanHabit } from '../domain/habit-plan';
import type {
  DayCalendar,
  HabitPlanRepository,
  LibraryDirectory,
  RecipientDirectory,
  ScoreStore,
  ScoredDay,
} from '../domain/ports';
import { averageOf } from '../domain/report';
import { averagePercent, percentOf } from '../domain/scoring';
import type { ScoreADay } from './score-a-day';

/** Un día de la rejilla, tal como lo pinta la pantalla. */
export interface PlanDayView {
  readonly day: string;
  readonly sent: number;
  readonly answered: number;
  readonly percent: number | null;
}

export interface PlanHabitView {
  readonly libraryId: string;
  readonly label: string;
  readonly percent: number | null;
  readonly days: readonly PlanDayView[];
}

/** Un plan tal como lo pinta la pantalla, con su rejilla ya armada. */
export interface PlanView {
  readonly id: string;
  readonly name: string;
  readonly recipientId: string;
  readonly recipientLabel: string;
  readonly durationDays: number;
  readonly timezone: string;
  readonly startOn: string;
  readonly endOn: string;
  readonly status: string;
  readonly dayNumber: number;
  readonly percent: number | null;
  readonly reportSentAt: Date | null;
  readonly habits: readonly PlanHabitView[];
}

export class CreateHabitPlan {
  constructor(
    private readonly plans: HabitPlanRepository,
    private readonly libraries: LibraryDirectory,
    private readonly recipients: RecipientDirectory,
    private readonly calendar: DayCalendar,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(
    ownerId: UserId,
    input: {
      name: string;
      recipientId: RecipientId;
      durationDays: number;
      libraryIds: readonly LibraryId[];
    },
    timezone: string,
  ): Promise<Result<HabitPlan, DomainError>> {
    const recipient = await this.recipients.find(input.recipientId, ownerId);

    // Que no sea de esta cuenta y que no exista se responden igual: confirmar
    // que existe ya diría algo de una cuenta ajena.
    if (!recipient) return err(new HabitPlanNotFound());

    // Sin chat no hay a dónde mandar los botones ni el informe del final.
    if (!recipient.chatId) return err(new RecipientNotLinked());

    const owned = await this.libraries.ownedAmong(ownerId, input.libraryIds);

    // Lo que no volvió es de otra cuenta o ya no está. Se dice una sola vez y
    // sin nombrar cuál: el usuario acaba de elegirlas de una lista suya.
    if (owned.length !== input.libraryIds.length) return err(new LibraryNotAvailable());

    if (owned.some((library) => library.isVault)) return err(new VaultIsNotAHabit());

    const [taken] = await this.plans.librariesInUse(input.libraryIds, input.recipientId);

    if (taken) return err(new LibraryAlreadyInPlan(taken.label));

    const now = this.clock.now();
    const habits: PlanHabit[] = owned.map((library) => ({
      libraryId: LibraryId.from(library.id),
      label: library.name,
    }));

    const plan = HabitPlan.create({
      id: HabitPlanId.from(this.ids.generate()),
      ownerId,
      recipientId: input.recipientId,
      name: input.name,
      durationDays: input.durationDays,
      timezone,
      today: this.calendar.dayAt(now, timezone),
      habits,
      now,
    });

    if (!plan.ok) return plan;

    await this.plans.add(plan.value);

    return ok(plan.value);
  }
}

/**
 * Anula un plan en marcha y libera sus bibliotecas.
 *
 * Antes de apagarlo cierra el día en curso. Sin eso, la última columna de la
 * rejilla quedaba vacía para siempre —el latido solo atiende planes vivos—, y
 * quien anulara a las once de la noche perdía el día entero de un plumazo.
 */
export class CancelHabitPlan {
  constructor(
    private readonly plans: HabitPlanRepository,
    private readonly scoreADay: ScoreADay,
    private readonly calendar: DayCalendar,
    private readonly clock: Clock,
  ) {}

  async execute(ownerId: UserId, planId: HabitPlanId): Promise<Result<HabitPlan, DomainError>> {
    const plan = await this.plans.findOwned(planId, ownerId);

    if (!plan) return err(new HabitPlanNotFound());

    const snapshot = plan.toSnapshot();

    if (snapshot.status === 'ACTIVE') {
      const today = this.calendar.dayAt(this.clock.now(), snapshot.timezone);

      // Solo lo que va del día de hoy, y solo si el plan sigue dentro de plazo.
      if (!plan.isScored(today) && today <= snapshot.endOn) {
        await this.scoreADay.execute(plan, today);
      }
    }

    const cancelled = plan.cancel();

    if (!cancelled.ok) return cancelled;

    await this.plans.save(plan);

    return ok(plan);
  }
}

/**
 * Arma la vista de uno o de todos los planes de una cuenta.
 *
 * El día en curso se suma al vuelo y no sale de las filas cerradas: si no,
 * quien acaba de apretar un botón no vería nada cambiar hasta medianoche, y la
 * pantalla parecería rota justo en el momento en que la está mirando.
 */
export class ReadHabitPlans {
  constructor(
    private readonly plans: HabitPlanRepository,
    private readonly scores: ScoreStore,
    private readonly scoreADay: ScoreADay,
    private readonly recipients: RecipientDirectory,
    private readonly calendar: DayCalendar,
    private readonly clock: Clock,
  ) {}

  async list(ownerId: UserId): Promise<PlanView[]> {
    const plans = await this.plans.listOwnedBy(ownerId);

    if (plans.length === 0) return [];

    const [scores, labels] = await Promise.all([
      this.scores.ofPlans(plans.map((plan) => plan.id)),
      this.recipients.labelsOf(
        ownerId,
        plans.map((plan) => plan.recipientId),
      ),
    ]);

    return plans.map((plan) =>
      this.view(plan, scores.get(plan.id) ?? [], labels.get(plan.recipientId) ?? '', false),
    );
  }

  async detail(ownerId: UserId, planId: HabitPlanId): Promise<Result<PlanView, DomainError>> {
    const plan = await this.plans.findOwned(planId, ownerId);

    if (!plan) return err(new HabitPlanNotFound());

    const [days, labels] = await Promise.all([
      this.scores.listOf(plan.id),
      this.recipients.labelsOf(ownerId, [plan.recipientId]),
    ]);

    const live = await this.today(plan);

    return ok(this.view(plan, [...days, ...live], labels.get(plan.recipientId) ?? '', true));
  }

  /**
   * El día que todavía corre, sumado al vuelo y sin escribir nada.
   *
   * Solo para el detalle: en el listado serían dos consultas por plan a cambio
   * de una barra que se mueve unas horas antes.
   */
  private async today(plan: HabitPlan): Promise<ScoredDay[]> {
    const snapshot = plan.toSnapshot();

    if (snapshot.status !== 'ACTIVE') return [];

    const day = this.calendar.dayAt(this.clock.now(), snapshot.timezone);

    // Ya cerrado, o el plazo terminó: lo que está escrito manda.
    if (plan.isScored(day) || day > snapshot.endOn) return [];

    return this.scoreADay.rowsOf(plan, day);
  }

  private view(
    plan: HabitPlan,
    days: readonly ScoredDay[],
    recipientLabel: string,
    withGrid: boolean,
  ): PlanView {
    const snapshot = plan.toSnapshot();
    const today = this.calendar.dayAt(this.clock.now(), snapshot.timezone);
    const last = min(today, snapshot.endOn);
    const habits: PlanHabitView[] = snapshot.habits.map((habit) => ({
      libraryId: habit.libraryId,
      label: habit.label,
      percent: averageOf(days, habit.libraryId),
      days: withGrid ? gridOf(days, habit.libraryId, snapshot.startOn, last) : [],
    }));

    return {
      id: snapshot.id,
      name: snapshot.name,
      recipientId: snapshot.recipientId,
      recipientLabel,
      durationDays: snapshot.durationDays,
      timezone: snapshot.timezone,
      startOn: snapshot.startOn,
      endOn: snapshot.endOn,
      status: snapshot.status,
      dayNumber: plan.dayNumber(today),
      percent: averagePercent(habits.map((habit) => habit.percent)),
      reportSentAt: snapshot.reportSentAt,
      habits,
    };
  }
}

/** La fila de un hábito, con un hueco por cada día que no llegó a cerrarse. */
function gridOf(
  days: readonly ScoredDay[],
  libraryId: string,
  from: CivilDay,
  to: CivilDay,
): PlanDayView[] {
  const byDay = new Map(
    days.filter((day) => day.libraryId === libraryId).map((day) => [day.day, day]),
  );

  return daysFrom(from, to).map((day) => {
    const row = byDay.get(day);

    return {
      day,
      sent: row?.sent ?? 0,
      answered: row?.answered ?? 0,
      percent: row ? percentOf(row) : null,
    };
  });
}

function min(left: CivilDay, right: CivilDay): CivilDay {
  return left < right ? left : right;
}
