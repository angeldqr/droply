import type { PlanHabit } from '../domain/habit-plan';
import { type HabitPlan } from '../domain/habit-plan';
import type {
  DayCalendar,
  DeliveryDirectory,
  HabitPlanRepository,
  ResponseStore,
  ScoredDay,
} from '../domain/ports';
import { scoreDay } from '../domain/scoring';
import type { CivilDay } from '../domain/civil-day';
import type { HabitAnswer } from '../domain/vocabulary';

/**
 * Suma un día de un plan y lo deja escrito.
 *
 * Vive aparte porque hay dos caminos que lo necesitan y ninguno de los dos es
 * dueño del otro: el latido, que cierra los días vencidos, y anular un plan,
 * que tiene que dejar cerrado el día en curso antes de apagarlo. Sin esto,
 * anular dejaba un hueco permanente en la última columna de la rejilla.
 */
export class ScoreADay {
  constructor(
    private readonly plans: HabitPlanRepository,
    private readonly deliveries: DeliveryDirectory,
    private readonly responses: ResponseStore,
    private readonly calendar: DayCalendar,
  ) {}

  /**
   * Cuenta ese día y lo escribe. Devuelve las filas si le tocó a este proceso,
   * o `null` si no había nada que cerrar o si otra réplica se adelantó.
   */
  async execute(plan: HabitPlan, day: CivilDay): Promise<ScoredDay[] | null> {
    const snapshot = plan.toSnapshot();
    const rows = await this.rowsOf(plan, day);

    const committed = await this.plans.commitDay({
      planId: snapshot.id,
      previous: snapshot.scoredThrough,
      day,
      rows,
    });

    if (!committed) return null;

    plan.markScored(day);

    return rows;
  }

  /** Lo que salió ese día y lo que se respondió, hábito por hábito. */
  async rowsOf(plan: HabitPlan, day: CivilDay): Promise<ScoredDay[]> {
    const snapshot = plan.toSnapshot();
    const { from, to } = this.calendar.boundsOf(day, snapshot.timezone);

    /*
     * El día no empieza antes que el plan.
     *
     * Un plan creado a media mañana no puede cargar con los envíos que ya
     * habían salido esa madrugada: salieron **sin botones**, porque entonces la
     * biblioteca todavía no era un hábito, así que nadie pudo responderlos.
     * Contándolos, el día 1 nacía castigado con un puñado de ceros que el
     * usuario no tenía forma de evitar.
     */
    const since = from < snapshot.createdAt ? snapshot.createdAt : from;

    const sent = await this.deliveries.sentBetween(
      snapshot.recipientId,
      snapshot.habits.map((habit) => habit.libraryId),
      since,
      to,
    );
    const answers = await this.responses.of(sent.map((delivery) => delivery.deliveryId));

    return rowsFor(snapshot.habits, day, sent, answers);
  }
}

/** Cruza lo que salió con lo que se respondió, hábito por hábito. */
export function rowsFor(
  habits: readonly PlanHabit[],
  day: CivilDay,
  sent: readonly { deliveryId: string; libraryId: string }[],
  answers: readonly { deliveryId: string; answer: HabitAnswer }[],
): ScoredDay[] {
  const byDelivery = new Map(answers.map((answer) => [answer.deliveryId, answer.answer]));

  return habits.map((habit) => {
    const mine = sent.filter((delivery) => delivery.libraryId === habit.libraryId);
    const given = mine
      .map((delivery) => byDelivery.get(delivery.deliveryId))
      .filter((answer): answer is HabitAnswer => answer !== undefined);

    return {
      libraryId: habit.libraryId,
      day,
      answered: given.length,
      ...scoreDay(mine.length, given),
    };
  });
}
