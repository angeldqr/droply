import {
  addDays,
  ALL_DAYS,
  appliesOn,
  dayIn,
  HABIT_DAILY_TARGET_MAX,
  isPausedOn,
  progressOf,
  type HabitPauseRange,
  type HabitProgress,
} from '@reconectate/contracts';
import { InvalidInputError } from '../../shared/domain-error';
import { HabitAlreadyPaused, HabitNotPaused } from './errors';
import type { HabitId, UserId } from '../../shared/identifiers';
import { err, ok, type Result } from '../../shared/result';

export const NAME_MAX_LENGTH = 40;

/**
 * Cuántos hábitos puede llevar una cuenta.
 *
 * El techo lo pone el chat y no la base: el bot manda la lista como un teclado,
 * y más de veinte obliga a bajar por una pantalla de teléfono para elegir uno.
 */
export const MAX_PER_ACCOUNT = 20;

/**
 * Hasta dónde se mira atrás para contar una racha.
 *
 * ponytail: una racha de más de un año se ve como de un año; si hace falta más,
 * guardar la racha calculada en vez de sumarla cada vez.
 */
export const STREAK_WINDOW_DAYS = 366;

export interface HabitSnapshot {
  readonly id: HabitId;
  readonly ownerId: UserId;
  readonly name: string;
  readonly position: number;
  /** Cuántas anotaciones en el día lo dan por cumplido. */
  readonly dailyTarget: number;
  /** En qué días aplica, con el lunes en el bit 0. */
  readonly activeDays: number;
  /** Los tramos en pausa, del más viejo al más nuevo. Ver `HabitPause`. */
  readonly pauses: readonly HabitPauseRange[];
  readonly createdAt: Date;
}

export interface HabitChanges {
  readonly name?: string | undefined;
  readonly dailyTarget?: number | undefined;
  readonly activeDays?: number | undefined;
}

/**
 * Un hábito: ejercicio, alimentación, lectura, lo que el usuario quiera.
 *
 * No manda nada y no recuerda nada. Es una carpeta a la que se le pegan
 * anotaciones desde el chat, con una meta que dice cuándo un día está cumplido:
 * tantas anotaciones, en tales días de la semana.
 */
export class Habit {
  private constructor(private state: HabitSnapshot) {}

  static create(input: {
    id: HabitId;
    ownerId: UserId;
    name: string;
    position: number;
    dailyTarget?: number | undefined;
    activeDays?: number | undefined;
    now: Date;
  }): Result<Habit, InvalidInputError> {
    const habit = new Habit({
      id: input.id,
      ownerId: input.ownerId,
      name: '',
      position: input.position,
      dailyTarget: 1,
      activeDays: ALL_DAYS,
      pauses: [],
      createdAt: input.now,
    });

    const applied = habit.update(input);

    return applied.ok ? ok(habit) : applied;
  }

  static fromSnapshot(snapshot: HabitSnapshot): Habit {
    return new Habit(snapshot);
  }

  toSnapshot(): HabitSnapshot {
    return this.state;
  }

  get id(): HabitId {
    return this.state.id;
  }

  get ownerId(): UserId {
    return this.state.ownerId;
  }

  get name(): string {
    return this.state.name;
  }

  get dailyTarget(): number {
    return this.state.dailyTarget;
  }

  /** Si la meta pide algo ese día (`AAAA-MM-DD`): no es día libre ni está en pausa. */
  appliesOn(day: string): boolean {
    return appliesOn(this.state.activeDays, day) && !this.isPausedOn(day);
  }

  isPausedOn(day: string): boolean {
    return isPausedOn(this.state.pauses, day);
  }

  /** Pone el hábito en pausa desde `today`, que ya no cuenta. */
  pause(today: string): Result<void, HabitAlreadyPaused> {
    // Una abierta, aunque empiece otro día: el índice de la base no deja dos.
    if (this.state.pauses.some((pause) => pause.to === null)) {
      return err(new HabitAlreadyPaused());
    }

    this.state = { ...this.state, pauses: [...this.state.pauses, { from: today, to: null }] };

    return ok();
  }

  /**
   * Cierra la pausa en curso: hoy ya cuenta otra vez, así que termina ayer.
   * Una pausa que empezó hoy no llegó a durar nada y se borra.
   */
  resume(today: string): Result<void, HabitNotPaused> {
    const open = this.state.pauses.find((pause) => pause.to === null);

    if (!open) return err(new HabitNotPaused());

    const yesterday = addDays(today, -1);
    const rest = this.state.pauses.filter((pause) => pause !== open);

    this.state = {
      ...this.state,
      pauses: open.from > yesterday ? rest : [...rest, { from: open.from, to: yesterday }],
    };

    return ok();
  }

  /**
   * Cómo va hasta `today`, con lo anotado cada día. Cuenta desde el día en que
   * se creó, cortado en la zona de la cuenta como todo lo demás.
   */
  progressOn(perDay: ReadonlyMap<string, number>, today: string, timezone: string): HabitProgress {
    return progressOf({
      perDay,
      goal: this.state,
      since: dayIn(timezone, this.state.createdAt),
      today,
      pauses: this.state.pauses,
    });
  }

  /** Cambia lo que venga; si algo no vale, no cambia nada. */
  update(changes: HabitChanges): Result<void, InvalidInputError> {
    const name = changes.name === undefined ? ok(this.state.name) : clean(changes.name);

    if (!name.ok) return name;

    const dailyTarget = changes.dailyTarget ?? this.state.dailyTarget;
    const activeDays = changes.activeDays ?? this.state.activeDays;

    if (!Number.isInteger(dailyTarget) || dailyTarget < 1 || dailyTarget > HABIT_DAILY_TARGET_MAX) {
      return err(
        new InvalidInputError(
          'habit.invalid_goal',
          `La meta va de 1 a ${HABIT_DAILY_TARGET_MAX} veces al día.`,
        ),
      );
    }

    if (!Number.isInteger(activeDays) || activeDays < 1 || activeDays > ALL_DAYS) {
      return err(new InvalidInputError('habit.invalid_goal', 'Elige al menos un día.'));
    }

    this.state = { ...this.state, name: name.value, dailyTarget, activeDays };

    return ok();
  }
}

function clean(name: string): Result<string, InvalidInputError> {
  const trimmed = name.trim();

  if (trimmed.length === 0 || trimmed.length > NAME_MAX_LENGTH) {
    return err(
      new InvalidInputError(
        'habit.invalid_name',
        `Ponle un nombre de hasta ${NAME_MAX_LENGTH} letras.`,
      ),
    );
  }

  return ok(trimmed);
}
