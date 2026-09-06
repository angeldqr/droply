import type { Clock } from '../../shared/clock';
import type { DomainError } from '../../shared/domain-error';
import { type HabitPlanId, type UserId } from '../../shared/identifiers';
import { err, ok, type Result } from '../../shared/result';
import { isBefore } from '../domain/civil-day';
import { HabitPlanNotClosed, HabitPlanNotFound, RecipientNotLinked } from '../domain/errors';
import type { HabitPlan } from '../domain/habit-plan';
import type {
  DayCalendar,
  HabitPlanRepository,
  PlanNotifier,
  RecipientDirectory,
  ScoreStore,
} from '../domain/ports';
import { closingReport, dailySummary } from '../domain/report';
import { percentOf } from '../domain/scoring';
import type { ScoreADay } from './score-a-day';

/** Cuántos planes atiende una vuelta. */
const BATCH = 50;

/**
 * Cierra los días vencidos de los planes vivos y manda lo que toque.
 *
 * Avanza **un día por plan y por vuelta**, no todos los pendientes de golpe.
 * Es la misma decisión que toma el calendario con las ocurrencias perdidas: si
 * el proceso estuvo caído tres días, se recuperan los tres, cada uno con su
 * resumen y en orden, en vez de saltárselos en silencio o de mandar tres
 * mensajes en el mismo segundo.
 *
 * El resumen sale **después** de que el día quedó escrito, y a propósito. Si
 * fuera al revés, un corte entre el mensaje y la escritura haría que el día se
 * cerrara otra vez en la vuelta siguiente y la persona recibiera dos veces el
 * mismo resumen. Así, el peor caso es un resumen perdido, que se nota mucho
 * menos y no ensucia el número.
 */
export class CloseDueDays {
  constructor(
    private readonly plans: HabitPlanRepository,
    private readonly scoreADay: ScoreADay,
    private readonly scores: ScoreStore,
    private readonly recipients: RecipientDirectory,
    private readonly notifier: PlanNotifier,
    private readonly calendar: DayCalendar,
    private readonly clock: Clock,
  ) {}

  /** Las claves `plan:día` que se cerraron, para que el latido las anote. */
  async execute(): Promise<string[]> {
    const now = this.clock.now();
    const due = await this.plans.listDueForScoring(now, BATCH);
    const closed: string[] = [];

    for (const plan of due) {
      // Un plan que reviente no puede llevarse por delante a los otros
      // cuarenta y nueve: lo suyo se anota y la vuelta sigue.
      const key = await this.closeOneDay(plan, now).catch(() => null);

      if (key) closed.push(key);
    }

    return closed;
  }

  private async closeOneDay(plan: HabitPlan, now: Date): Promise<string | null> {
    const snapshot = plan.toSnapshot();
    const day = plan.nextDayToScore();

    // El día todavía corre en la zona de este plan. La consulta ya lo filtra;
    // esta guarda existe porque el reloj de la aplicación y el de la base no
    // tienen por qué ser el mismo, y cerrar un día a medias sería contar mal.
    if (!isBefore(day, this.calendar.dayAt(now, snapshot.timezone))) return null;

    const rows = await this.scoreADay.execute(plan, day);

    // Otra réplica cerró este mismo día mientras se sumaba. Suya es también la
    // tarea de avisar; acá no queda nada que hacer.
    if (!rows) return null;

    const chatId = await this.recipients.chatOf(snapshot.ownerId, snapshot.recipientId);

    if (chatId) {
      await this.notifier.send(
        chatId,
        dailySummary({
          planName: snapshot.name,
          dayNumber: plan.dayNumber(day),
          durationDays: snapshot.durationDays,
          lines: rows.map((row) => ({
            label: plan.labelOf(row.libraryId),
            percent: percentOf(row),
          })),
        }),
      );
    }

    if (plan.hasRunItsCourse()) await this.finish(plan, chatId, now);

    return `${snapshot.id}:${day}`;
  }

  /** El plazo se acabó: se cierra el plan y sale el informe, una sola vez. */
  private async finish(plan: HabitPlan, chatId: string | null, now: Date): Promise<void> {
    const closed = plan.close(now);

    if (!closed.ok) return;

    await this.plans.save(plan);

    if (!chatId) return;

    const sent = await this.notifier.send(chatId, await reportOf(plan, this.scores));

    /*
     * Solo se sella si salió. El notificador se traga los fallos para no tumbar
     * el latido, así que sellar sin mirar dejaría al dueño viendo una fecha de
     * envío que nunca ocurrió, y sin forma de saber que tiene que reenviarlo.
     */
    if (!sent) return;

    plan.markReportSent(now);
    await this.plans.save(plan);
  }
}

/**
 * Vuelve a mandar el informe de un plan que ya terminó.
 *
 * Es lo único que se le puede hacer a un plan cerrado, y por eso vive en su
 * propio caso de uso en vez de en un `update` con una bandera: la API no tiene
 * ninguna forma de modificar un plan, y eso es una propiedad, no un descuido.
 */
export class SendPlanReport {
  constructor(
    private readonly plans: HabitPlanRepository,
    private readonly scores: ScoreStore,
    private readonly recipients: RecipientDirectory,
    private readonly notifier: PlanNotifier,
    private readonly clock: Clock,
  ) {}

  async execute(ownerId: UserId, planId: HabitPlanId): Promise<Result<void, DomainError>> {
    const plan = await this.plans.findOwned(planId, ownerId);

    if (!plan) return err(new HabitPlanNotFound());

    const snapshot = plan.toSnapshot();

    if (snapshot.status !== 'CLOSED') return err(new HabitPlanNotClosed());

    const chatId = await this.recipients.chatOf(ownerId, snapshot.recipientId);

    // El destinatario se desvinculó después de que el plan terminara. No es un
    // fallo del plan, así que se dice como lo que es.
    if (!chatId) return err(new RecipientNotLinked());

    const sent = await this.notifier.send(chatId, await reportOf(plan, this.scores));

    // Que Telegram lo rechace no se traga: el dueño acaba de pedir esto a mano
    // y tiene que enterarse de que no salió.
    if (!sent) return err(new RecipientNotLinked());

    const sealed = plan.markReportSent(this.clock.now());

    if (!sealed.ok) return sealed;

    await this.plans.save(plan);

    return ok();
  }
}

/** El texto del informe de cierre. Lo arman igual el latido y el reenvío. */
async function reportOf(plan: HabitPlan, scores: ScoreStore): Promise<string> {
  const snapshot = plan.toSnapshot();

  return closingReport({
    planName: snapshot.name,
    durationDays: snapshot.durationDays,
    habits: snapshot.habits,
    days: await scores.listOf(snapshot.id),
  });
}
