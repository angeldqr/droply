import type { InvalidInputError } from '../../shared/domain-error';
import type { UserId } from '../../shared/identifiers';
import { err, ok, type Result } from '../../shared/result';
import { SessionExpired } from '../domain/errors';
import type { UserRepository } from '../domain/ports';
import type { User } from '../domain/user';

/**
 * Cambia la zona horaria de quien ya entró.
 *
 * Es la que decide a qué hora termina el día en la bitácora: con la zona
 * equivocada, a las ocho de la noche de un sábado ya era domingo.
 */
export class ChangeTimezone {
  constructor(private readonly users: UserRepository) {}

  async execute(
    userId: UserId,
    timezone: string,
  ): Promise<Result<User, SessionExpired | InvalidInputError>> {
    const user = await this.users.findById(userId);

    if (!user) return err(new SessionExpired());

    const changed = user.changeTimezone(timezone);
    if (!changed.ok) return changed;

    await this.users.save(user);

    return ok(user);
  }
}
