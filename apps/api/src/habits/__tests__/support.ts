import { FixedClock } from '../../shared/clock';
import {
  HabitPlanId,
  LibraryId,
  RecipientId,
  UserId,
  type IdGenerator,
} from '../../shared/identifiers';
import { CastHabitVote } from '../application/cast-habit-vote';
import { CloseDueDays, SendPlanReport } from '../application/close-due-days';
import { ScoreADay } from '../application/score-a-day';
import {
  CancelHabitPlan,
  CreateHabitPlan,
  ReadHabitPlans,
} from '../application/habit-plan-use-cases';
import type { CivilDay } from '../domain/civil-day';
import { addDays, isBefore } from '../domain/civil-day';
import type { HabitPlan } from '../domain/habit-plan';
import type {
  DayCalendar,
  DeliveryDirectory,
  HabitPlanRepository,
  LibraryDirectory,
  PlanNotifier,
  RecipientDirectory,
  ResponseStore,
  ScoreStore,
  ScoredDay,
  SentDelivery,
  StoredResponse,
} from '../domain/ports';
import type { HabitAnswer } from '../domain/vocabulary';

export const ANA = UserId.from('11111111-1111-4111-8111-111111111111');
export const OTRO = UserId.from('99999999-9999-4999-8999-999999999999');
export const DESTINATARIO = RecipientId.from('22222222-2222-4222-8222-222222222222');
export const OTRO_DESTINATARIO = RecipientId.from('66666666-6666-4666-8666-666666666666');
export const EJERCICIO = LibraryId.from('33333333-3333-4333-8333-333333333333');
export const LEER = LibraryId.from('44444444-4444-4444-8444-444444444444');
export const BAUL = LibraryId.from('55555555-5555-4555-8555-555555555555');

/** Las once de la mañana del 11 de mayo en Bogotá. */
export const AHORA = new Date('2026-05-11T16:00:00.000Z');

export const HOY: CivilDay = '2026-05-11';

const ZONA = 'America/Bogota';

/**
 * Un calendario de mentira que corta el día a medianoche UTC.
 *
 * No usa Luxon a propósito: lo que se prueba acá es la lógica del plan, no la
 * base de zonas horarias. El adaptador de verdad tiene su propio motivo para
 * existir y estos tests no deberían romperse si alguien cambia de librería.
 */
export class FakeCalendar implements DayCalendar {
  dayAt(moment: Date): CivilDay {
    return moment.toISOString().slice(0, 10);
  }

  boundsOf(day: CivilDay): { from: Date; to: Date } {
    return {
      from: new Date(`${day}T00:00:00.000Z`),
      to: new Date(`${addDays(day, 1)}T00:00:00.000Z`),
    };
  }
}

export class FakePlans implements HabitPlanRepository {
  readonly rows = new Map<string, HabitPlan>();
  /** El día cerrado de cada plan, tal como lo escribiría `commitDay`. */
  readonly days = new Map<string, ScoredDay[]>();
  /** Qué envío pertenece a qué plan, que es lo que resuelve la consulta real. */
  readonly deliveries = new Map<
    string,
    { planId: string; libraryId: string; chatId: string | null; occurredAt: Date }
  >();

  add(plan: HabitPlan): Promise<void> {
    this.rows.set(plan.id, plan);

    return Promise.resolve();
  }

  save(plan: HabitPlan): Promise<void> {
    this.rows.set(plan.id, plan);

    return Promise.resolve();
  }

  listOwnedBy(ownerId: UserId): Promise<HabitPlan[]> {
    return Promise.resolve([...this.rows.values()].filter((plan) => plan.ownerId === ownerId));
  }

  findOwned(id: string, ownerId: UserId): Promise<HabitPlan | null> {
    const plan = this.rows.get(id);

    // El dueño va en la consulta, no en un chequeo posterior: lo ajeno no
    // existe, no está prohibido.
    return Promise.resolve(plan && plan.ownerId === ownerId ? plan : null);
  }

  librariesInUse(
    libraryIds: readonly string[],
    recipientId: string,
  ): Promise<{ libraryId: string; label: string }[]> {
    const taken: { libraryId: string; label: string }[] = [];

    for (const plan of this.rows.values()) {
      // La pareja, no la biblioteca sola: la misma puede ser un hábito de dos
      // planes mientras vayan a personas distintas.
      if (plan.status !== 'ACTIVE' || plan.recipientId !== recipientId) continue;

      for (const habit of plan.habits) {
        if (libraryIds.includes(habit.libraryId)) {
          taken.push({ libraryId: habit.libraryId, label: habit.label });
        }
      }
    }

    return Promise.resolve(taken);
  }

  listDueForScoring(now: Date): Promise<HabitPlan[]> {
    const today = new FakeCalendar().dayAt(now);

    return Promise.resolve(
      [...this.rows.values()].filter(
        (plan) => plan.status === 'ACTIVE' && isBefore(plan.nextDayToScore(), today),
      ),
    );
  }

  commitDay(input: {
    planId: string;
    previous: CivilDay | null;
    day: CivilDay;
    rows: readonly ScoredDay[];
  }): Promise<boolean> {
    const plan = this.rows.get(input.planId);

    // El bloqueo optimista de la base, en miniatura: si otro ya avanzó el plan,
    // la condición no encaja y no se escribe nada.
    if (!plan || plan.toSnapshot().scoredThrough !== input.previous) return Promise.resolve(false);

    plan.markScored(input.day);
    this.days.set(input.planId, [...(this.days.get(input.planId) ?? []), ...input.rows]);

    return Promise.resolve(true);
  }

  findActiveForDelivery(deliveryId: string): Promise<{
    plan: HabitPlan;
    libraryId: string;
    chatId: string | null;
    occurredAt: Date;
  } | null> {
    const found = this.deliveries.get(deliveryId);
    const plan = found ? this.rows.get(found.planId) : undefined;

    if (!found || !plan || plan.status !== 'ACTIVE') return Promise.resolve(null);

    return Promise.resolve({
      plan,
      libraryId: found.libraryId,
      chatId: found.chatId,
      occurredAt: found.occurredAt,
    });
  }
}

export class FakeLibraries implements LibraryDirectory {
  readonly rows = [
    { id: EJERCICIO, name: 'Ejercicio', isVault: false },
    { id: LEER, name: 'Leer', isVault: false },
    { id: BAUL, name: 'Baúl', isVault: true },
  ];

  ownedAmong(
    ownerId: UserId,
    libraryIds: readonly string[],
  ): Promise<{ id: string; name: string; isVault: boolean }[]> {
    if (ownerId !== ANA) return Promise.resolve([]);

    return Promise.resolve(this.rows.filter((row) => libraryIds.includes(row.id)));
  }
}

export class FakeRecipients implements RecipientDirectory {
  chatId: string | null = '555';

  find(
    recipientId: string,
    ownerId: UserId,
  ): Promise<{ label: string; chatId: string | null } | null> {
    const conocido = recipientId === DESTINATARIO || recipientId === OTRO_DESTINATARIO;

    if (!conocido || ownerId !== ANA) return Promise.resolve(null);

    return Promise.resolve({
      label: recipientId === DESTINATARIO ? 'Angel' : 'Mamá',
      chatId: this.chatId,
    });
  }

  labelsOf(ownerId: UserId, recipientIds: readonly string[]): Promise<Map<string, string>> {
    if (ownerId !== ANA) return Promise.resolve(new Map<string, string>());

    return Promise.resolve(new Map(recipientIds.map((id) => [id, 'Angel'] as const)));
  }

  chatOf(ownerId: UserId): Promise<string | null> {
    return Promise.resolve(ownerId === ANA ? this.chatId : null);
  }
}

export class FakeDeliveries implements DeliveryDirectory {
  /** Los envíos que salieron, con el instante en que salieron. */
  readonly rows: { deliveryId: string; libraryId: string; at: Date }[] = [];

  sentBetween(
    _recipientId: string,
    libraryIds: readonly string[],
    from: Date,
    to: Date,
  ): Promise<SentDelivery[]> {
    return Promise.resolve(
      this.rows
        .filter((row) => libraryIds.includes(row.libraryId) && row.at >= from && row.at < to)
        .map((row) => ({ deliveryId: row.deliveryId, libraryId: row.libraryId })),
    );
  }
}

export class FakeResponses implements ResponseStore {
  readonly rows = new Map<string, StoredResponse>();

  record(response: {
    deliveryId: string;
    libraryId: string;
    answer: HabitAnswer;
  }): Promise<boolean> {
    // La clave primaria de la tabla: el segundo intento sobre el mismo envío no
    // entra, y eso es lo que hace que una votación no se pueda cambiar.
    if (this.rows.has(response.deliveryId)) return Promise.resolve(false);

    this.rows.set(response.deliveryId, {
      deliveryId: response.deliveryId,
      libraryId: response.libraryId,
      answer: response.answer,
    });

    return Promise.resolve(true);
  }

  of(deliveryIds: readonly string[]): Promise<StoredResponse[]> {
    return Promise.resolve(
      deliveryIds.flatMap((id) => {
        const row = this.rows.get(id);

        return row ? [row] : [];
      }),
    );
  }
}

export class FakeScores implements ScoreStore {
  constructor(private readonly plans: FakePlans) {}

  listOf(planId: string): Promise<ScoredDay[]> {
    return Promise.resolve(this.plans.days.get(planId) ?? []);
  }

  ofPlans(planIds: readonly string[]): Promise<Map<string, ScoredDay[]>> {
    return Promise.resolve(
      new Map(planIds.map((id) => [id, this.plans.days.get(id) ?? []] as const)),
    );
  }
}

export class FakeNotifier implements PlanNotifier {
  readonly sent: { chatId: string; text: string }[] = [];
  /** Para poder probar que un informe que no sale no se sella como enviado. */
  entrega = true;

  send(chatId: string, text: string): Promise<boolean> {
    if (this.entrega) this.sent.push({ chatId, text });

    return Promise.resolve(this.entrega);
  }
}

class SequentialIds implements IdGenerator {
  private next = 0;

  generate(): string {
    this.next += 1;

    return `aaaaaaaa-aaaa-4aaa-8aaa-${String(this.next).padStart(12, '0')}`;
  }
}

export function build() {
  const clock = new FixedClock(AHORA);
  const plans = new FakePlans();
  const libraries = new FakeLibraries();
  const recipients = new FakeRecipients();
  const deliveries = new FakeDeliveries();
  const responses = new FakeResponses();
  const scores = new FakeScores(plans);
  const notifier = new FakeNotifier();
  const calendar = new FakeCalendar();
  const ids = new SequentialIds();
  const scoreADay = new ScoreADay(plans, deliveries, responses, calendar);

  return {
    clock,
    plans,
    libraries,
    recipients,
    deliveries,
    responses,
    scores,
    notifier,
    calendar,
    scoreADay,
    create: new CreateHabitPlan(plans, libraries, recipients, calendar, ids, clock),
    cancel: new CancelHabitPlan(plans, scoreADay, calendar, clock),
    read: new ReadHabitPlans(plans, scores, scoreADay, recipients, calendar, clock),
    close: new CloseDueDays(plans, scoreADay, scores, recipients, notifier, calendar, clock),
    report: new SendPlanReport(plans, scores, recipients, notifier, clock),
    vote: new CastHabitVote(plans, responses, calendar, clock),
  };
}

export type World = ReturnType<typeof build>;

/** Un plan de siete días sobre las dos bibliotecas, ya creado. */
export async function unPlan(world: World, durationDays = 7): Promise<HabitPlan> {
  const created = await world.create.execute(
    ANA,
    {
      name: 'Yo en 30 días',
      recipientId: DESTINATARIO,
      durationDays,
      libraryIds: [EJERCICIO, LEER],
    },
    ZONA,
  );

  if (!created.ok) throw created.error;

  return created.value;
}

/** Anota un envío que salió, y lo ata a su plan como haría la consulta real. */
export function unEnvio(
  world: World,
  plan: HabitPlan,
  input: { deliveryId: string; libraryId: string; at: Date },
): void {
  world.deliveries.rows.push(input);
  world.plans.deliveries.set(input.deliveryId, {
    planId: plan.id,
    libraryId: input.libraryId,
    chatId: world.recipients.chatId,
    occurredAt: input.at,
  });
}

export { HabitPlanId, ZONA };
