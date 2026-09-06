import { InvalidInputError } from '../../shared/domain-error';
import type { HabitPlanId, LibraryId, RecipientId, UserId } from '../../shared/identifiers';
import { err, ok, type Result } from '../../shared/result';
import { addDays, daysBetween, isAfter, type CivilDay } from './civil-day';
import { HabitPlanNotActive, HabitPlanNotClosed } from './errors';
import type { HabitPlanStatus } from './vocabulary';

export const NAME_MAX_LENGTH = 60;

/**
 * Cuántas bibliotecas caben en un plan.
 *
 * Es el mismo tope que el de bibliotecas por cuenta, así que en la práctica no
 * puede morder: existe solo para que el borde HTTP no acepte un arreglo sin
 * fondo. El cliente pidió «una o varias» y esto no lo contradice.
 */
export const LIBRARIES_MAX = 20;

/** Los cuatro plazos, cerrados. El contrato repite la lista para la pantalla. */
export const DURATIONS = [7, 14, 21, 30] as const;

/** Una biblioteca dentro del plan, o sea un hábito. */
export interface PlanHabit {
  readonly libraryId: LibraryId;
  /**
   * El nombre con el que la biblioteca entró al plan.
   *
   * Se copia y no se vuelve a leer: un plan terminado tiene que seguir
   * enseñando lo mismo dentro de un año, y para entonces la biblioteca puede
   * llamarse de otra forma o no existir.
   */
  readonly label: string;
}

export interface HabitPlanSnapshot {
  readonly id: HabitPlanId;
  readonly ownerId: UserId;
  readonly recipientId: RecipientId;
  readonly name: string;
  readonly durationDays: number;
  readonly timezone: string;
  readonly startOn: CivilDay;
  readonly endOn: CivilDay;
  readonly status: HabitPlanStatus;
  readonly scoredThrough: CivilDay | null;
  readonly closedAt: Date | null;
  readonly reportSentAt: Date | null;
  readonly habits: readonly PlanHabit[];
  readonly createdAt: Date;
}

/**
 * Un plan de hábitos.
 *
 * Lo que define a esta entidad no es lo que puede hacer sino lo que **no**: una
 * vez creado no se le cambian ni las bibliotecas ni la fecha de cierre. Por eso
 * no hay ningún método que las toque, y por eso la API no expone un `PATCH`.
 * La única salida antes de tiempo es anularlo, que libera las bibliotecas.
 *
 * `scoredThrough` es el último día con la cuenta cerrada, y avanza de a uno.
 * Nunca salta: si el proceso estuvo caído tres días, se ponen al día los tres,
 * cada uno con su resumen. Saltárselos dejaría huecos en la rejilla que nadie
 * podría explicar después.
 */
export class HabitPlan {
  private constructor(private state: HabitPlanSnapshot) {}

  static create(input: {
    id: HabitPlanId;
    ownerId: UserId;
    recipientId: RecipientId;
    name: string;
    durationDays: number;
    timezone: string;
    /** Hoy, ya traducido a la zona de la cuenta. El plan arranca hoy mismo. */
    today: CivilDay;
    habits: readonly PlanHabit[];
    now: Date;
  }): Result<HabitPlan, InvalidInputError> {
    const name = input.name.trim();

    if (name.length === 0 || name.length > NAME_MAX_LENGTH) {
      return err(
        new InvalidInputError('habit_plan.invalid_name', 'Ponle un nombre de hasta 60 letras.'),
      );
    }

    if (!(DURATIONS as readonly number[]).includes(input.durationDays)) {
      return err(
        new InvalidInputError('habit_plan.invalid_duration', 'El plazo es de 7, 14, 21 o 30 días.'),
      );
    }

    if (input.habits.length === 0 || input.habits.length > LIBRARIES_MAX) {
      return err(
        new InvalidInputError(
          'habit_plan.invalid_habits',
          `Elige entre una y ${LIBRARIES_MAX} bibliotecas.`,
        ),
      );
    }

    return ok(
      new HabitPlan({
        id: input.id,
        ownerId: input.ownerId,
        recipientId: input.recipientId,
        name,
        durationDays: input.durationDays,
        timezone: input.timezone,
        startOn: input.today,
        // Menos uno porque el primer día es el de hoy: un plan de siete días
        // que arranca el lunes termina el domingo, no el lunes siguiente.
        endOn: addDays(input.today, input.durationDays - 1),
        status: 'ACTIVE',
        scoredThrough: null,
        closedAt: null,
        reportSentAt: null,
        habits: [...input.habits],
        createdAt: input.now,
      }),
    );
  }

  static fromSnapshot(snapshot: HabitPlanSnapshot): HabitPlan {
    return new HabitPlan(snapshot);
  }

  toSnapshot(): HabitPlanSnapshot {
    return this.state;
  }

  get id(): HabitPlanId {
    return this.state.id;
  }

  get ownerId(): UserId {
    return this.state.ownerId;
  }

  get recipientId(): RecipientId {
    return this.state.recipientId;
  }

  get status(): HabitPlanStatus {
    return this.state.status;
  }

  get timezone(): string {
    return this.state.timezone;
  }

  get habits(): readonly PlanHabit[] {
    return this.state.habits;
  }

  /** El primer día que todavía no tiene la cuenta cerrada. */
  nextDayToScore(): CivilDay {
    const scored = this.state.scoredThrough;

    return scored === null ? this.state.startOn : addDays(scored, 1);
  }

  /** Si ese día ya cerró y no admite más respuestas. */
  isScored(day: CivilDay): boolean {
    const scored = this.state.scoredThrough;

    return scored !== null && !isAfter(day, scored);
  }

  /** Si ya se cerró el último día del plazo y toca terminar. */
  hasRunItsCourse(): boolean {
    const scored = this.state.scoredThrough;

    return scored !== null && !isAfter(this.state.endOn, scored);
  }

  /** Cómo se llamaba la biblioteca de ese hábito cuando entró al plan. */
  labelOf(libraryId: string): string {
    return this.state.habits.find((habit) => habit.libraryId === libraryId)?.label ?? 'Sin nombre';
  }

  /** Qué día del plan es ese, de 1 en adelante. */
  dayNumber(day: CivilDay): number {
    return Math.min(this.state.durationDays, Math.max(1, daysBetween(this.state.startOn, day) + 1));
  }

  /** Anota que ese día ya tiene su cuenta hecha. */
  markScored(day: CivilDay): void {
    this.state = { ...this.state, scoredThrough: day };
  }

  /**
   * Lo termina porque llegó a su último día.
   *
   * A partir de acá el plan es de solo lectura: sus bibliotecas quedan libres y
   * lo único que se le puede pedir es que vuelva a mandar el informe.
   */
  close(now: Date): Result<void, HabitPlanNotActive> {
    if (this.state.status !== 'ACTIVE') return err(new HabitPlanNotActive());

    this.state = { ...this.state, status: 'CLOSED', closedAt: now };

    return ok();
  }

  /** Lo anula antes de tiempo. Las bibliotecas vuelven a estar libres. */
  cancel(): Result<void, HabitPlanNotActive> {
    if (this.state.status !== 'ACTIVE') return err(new HabitPlanNotActive());

    this.state = { ...this.state, status: 'CANCELLED' };

    return ok();
  }

  /** Sella que el informe salió. Solo tiene sentido con el plan terminado. */
  markReportSent(now: Date): Result<void, HabitPlanNotClosed> {
    if (this.state.status !== 'CLOSED') return err(new HabitPlanNotClosed());

    this.state = { ...this.state, reportSentAt: now };

    return ok();
  }
}
