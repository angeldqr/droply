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
  readonly createdAt: Date;
}

/**
 * Un hábito: ejercicio, alimentación, lectura, lo que el usuario quiera.
 *
 * No manda nada y no recuerda nada. Es una carpeta a la que se le pegan
 * anotaciones desde el chat, y esa es toda la diferencia con un horario.
 */
export class Habit {
  private constructor(private state: HabitSnapshot) {}

  static create(input: {
    id: HabitId;
    ownerId: UserId;
    name: string;
    position: number;
    now: Date;
  }): Result<Habit, InvalidInputError> {
    const name = clean(input.name);

    if (!name.ok) return name;

    return ok(
      new Habit({
        id: input.id,
        ownerId: input.ownerId,
        name: name.value,
        position: input.position,
        createdAt: input.now,
      }),
    );
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

  rename(name: string): Result<void, InvalidInputError> {
    const clean_ = clean(name);

    if (!clean_.ok) return clean_;

    this.state = { ...this.state, name: clean_.value };

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
