import type { Clock } from '../../shared/clock';
import type { HabitPlan } from '../domain/habit-plan';
import type {
  DayCalendar,
  HabitPlanRepository,
  PlanNotifier,
  RecipientDirectory,
} from '../domain/ports';
import { dueProgressSlot } from '../domain/progress-slots';
import { progressReport } from '../domain/report';
import { percentOf } from '../domain/scoring';
import type { ScoreADay } from './score-a-day';

/**
 * Manda los avisos de progreso que tocan: cómo va hoy cada hábito del plan.
 *
 * El aviso se reclama **antes** de mandarlo, al revés que el resumen del día.
 * Aquí el peor caso aceptable es un aviso perdido; uno repetido, en cambio, le
 * llegaría a la persona dos veces seguidas con el mismo texto.
 */
export class SendPlanProgress {
  constructor(
    private readonly plans: HabitPlanRepository,
    private readonly scoreADay: ScoreADay,
    private readonly recipients: RecipientDirectory,
    private readonly notifier: PlanNotifier,
    private readonly calendar: DayCalendar,
    private readonly clock: Clock,
  ) {}

  /** Las claves `plan:hora` de los avisos que salieron, para el latido. */
  async execute(): Promise<string[]> {
    const now = this.clock.now();
    const sent: string[] = [];

    for (const plan of await this.plans.listWithProgress()) {
      // Igual que al cerrar días: un plan que falle no frena a los demás.
      const key = await this.sendOne(plan, now).catch(() => null);

      if (key) sent.push(key);
    }

    return sent;
  }

  private async sendOne(plan: HabitPlan, now: Date): Promise<string | null> {
    const snapshot = plan.toSnapshot();
    const today = this.calendar.dayAt(now, snapshot.timezone);

    if (today < snapshot.startOn || today > snapshot.endOn) return null;

    const slot = dueProgressSlot({
      now,
      midnight: this.calendar.boundsOf(today, snapshot.timezone).from,
      perDay: snapshot.progressPerDay,
      lastSentAt: snapshot.progressSentAt,
      notBefore: snapshot.createdAt,
    });

    if (!slot) return null;

    const chatId = await this.recipients.chatOf(snapshot.ownerId, snapshot.recipientId);

    if (!chatId || !(await this.plans.claimProgress(snapshot.id, slot))) return null;

    const rows = await this.scoreADay.rowsOf(plan, today);

    await this.notifier.send(
      chatId,
      progressReport({
        planName: snapshot.name,
        lines: snapshot.habits.map((habit) => {
          const row = rows.find((candidate) => candidate.libraryId === habit.libraryId);

          return {
            label: habit.label,
            sent: row?.sent ?? 0,
            answered: row?.answered ?? 0,
            percent: row ? percentOf(row) : null,
          };
        }),
      }),
    );

    return `${snapshot.id}:${slot.toISOString()}`;
  }
}
