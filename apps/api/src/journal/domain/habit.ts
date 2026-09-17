import { ALL_DAYS, appliesOn, HABIT_DAILY_TARGET_MAX } from '@reconectate/contracts';
import { InvalidInputError } from '../../shared/domain-error';
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

export interface HabitSnapshot {
  readonly id: HabitId;
  readonly ownerId: UserId;
  readonly name: string;
  readonly position: number;
  /** Cuántas anotaciones en el día lo dan por cumplido. */
  readonly dailyTarget: number;
  /** En qué días aplica, con el lunes en el bit 0. */
  readonly activeDays: number;
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

  /** Si la meta pide algo ese día (`AAAA-MM-DD`). */
  appliesOn(day: string): boolean {
    return appliesOn(this.state.activeDays, day);
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
