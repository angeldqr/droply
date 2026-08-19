import type { Clock } from '../../shared/clock';
import { NotFoundError } from '../../shared/domain-error';
import type { UserId } from '../../shared/identifiers';
import type { OwnerStorage } from '../../shared/owner-storage';
import { err, ok, type Result } from '../../shared/result';
import { AdminCannotBeRemoved } from '../domain/errors';
import type { User } from '../domain/user';
import type {
  PasswordHasher,
  RefreshTokenRepository,
  SecretTokenFactory,
  UserRepository,
} from '../domain/ports';

/**
 * Cuántos caracteres tiene la contraseña temporal.
 *
 * 18 del alfabeto base64url son más de cien bits: nadie la adivina, y es corta
 * como para dictarla por teléfono, que es exactamente lo que va a pasar con
 * ella. El mínimo de una contraseña normal son 12, así que también los cumple.
 */
const TEMPORARY_PASSWORD_LENGTH = 18;

/**
 * Le pone a una cuenta una contraseña nueva y la devuelve **una sola vez**.
 *
 * Se devuelve en pantalla en vez de mandarla por correo a propósito: este es el
 * camino que tiene que funcionar cuando el correo no llega, que es justo cuando
 * alguien necesita que le devuelvan el acceso. Quien administra se la dicta a
 * su dueño y esa persona la cambia desde su cuenta.
 *
 * No se guarda en ningún lado más que hasheada, así que no hay forma de volver
 * a verla: la misma regla que los enlaces de vinculación, y la pantalla lo
 * avisa con las mismas palabras.
 */
export class ResetAccountPassword {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly sessions: RefreshTokenRepository,
    private readonly clock: Clock,
    /* El mismo generador de secretos de los enlaces: aleatoriedad del sistema,
       que es lo único que se le pide a una contraseña que nadie va a recordar. */
    private readonly secrets: SecretTokenFactory,
  ) {}

  async execute(userId: UserId): Promise<Result<{ password: string }, NotFoundError>> {
    const user = await this.users.findById(userId);
    if (!user) return err(new NotFoundError('la cuenta', 'admin.account_not_found'));

    const password = this.secrets.create().value.slice(0, TEMPORARY_PASSWORD_LENGTH);

    user.changePassword(await this.hasher.hash(password));
    await this.users.save(user);

    // Si se restablece porque alguien perdió el control de la cuenta, dejar
    // vivas las sesiones abiertas no arreglaría nada.
    await this.sessions.revokeAllOf(userId, this.clock.now());

    return ok({ password });
  }
}

/**
 * Corta o devuelve el acceso a una cuenta, sin borrar nada de lo suyo.
 *
 * Es lo que se usa de verdad cuando alguien deja de estar: sus bibliotecas y
 * sus horarios siguen ahí, y si vuelve, vuelve entero. Borrar es para cuando ya
 * no se quiere nada de esa cuenta.
 */
export class SetAccountActive {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: RefreshTokenRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    actorId: UserId,
    userId: UserId,
    active: boolean,
  ): Promise<Result<void, NotFoundError | AdminCannotBeRemoved>> {
    if (!active && actorId === userId) {
      return err(new AdminCannotBeRemoved('No puedes desactivar tu propia cuenta.'));
    }

    const user = await this.users.findById(userId);
    if (!user) return err(new NotFoundError('la cuenta', 'admin.account_not_found'));

    if (!active && (await leavesNoAdmin(this.users, user))) {
      return err(
        new AdminCannotBeRemoved(
          'Es el único administrador que puede entrar. Sin él nadie podría crear cuentas ni devolver accesos.',
        ),
      );
    }

    const now = this.clock.now();

    if (active) user.reactivate();
    else user.deactivate(now);

    await this.users.save(user);

    // Desactivar sin cerrarle la sesión la dejaría dentro hasta que venciera
    // su token de refresco, o sea días.
    if (!active) await this.sessions.revokeAllOf(userId, now);

    return ok();
  }
}

/**
 * Borra una cuenta y todo lo suyo.
 *
 * Las filas se van por cascada; los objetos del almacenamiento no los borra
 * nadie, así que hay que pedirlo. Se hace **antes** de borrar la fila: si el
 * almacenamiento falla, la cuenta sigue ahí y se puede reintentar, mientras que
 * al revés quedarían archivos de alguien que ya no existe y nadie sabría de
 * quién eran.
 */
export class DeleteAccount {
  constructor(
    private readonly users: UserRepository,
    private readonly storage: OwnerStorage,
  ) {}

  async execute(
    actorId: UserId,
    userId: UserId,
  ): Promise<Result<void, NotFoundError | AdminCannotBeRemoved>> {
    if (actorId === userId) {
      return err(new AdminCannotBeRemoved('No puedes borrar tu propia cuenta.'));
    }

    const user = await this.users.findById(userId);
    if (!user) return err(new NotFoundError('la cuenta', 'admin.account_not_found'));

    if (await leavesNoAdmin(this.users, user)) {
      return err(
        new AdminCannotBeRemoved(
          'Es el único administrador que puede entrar. Sin él nadie podría crear cuentas ni devolver accesos.',
        ),
      );
    }

    await this.storage.removeAllOf(userId);
    await this.users.remove(userId);

    return ok();
  }
}

/**
 * Si quitar a esta cuenta dejaría el sistema sin ningún administrador capaz de
 * entrar.
 *
 * Se resta solo si la cuenta **cuenta hoy**: quitar a un administrador que ya
 * estaba desactivado no cambia cuántos pueden entrar, así que no hay por qué
 * impedirlo.
 */
async function leavesNoAdmin(
  users: { countActiveAdmins(): Promise<number> },
  user: User,
): Promise<boolean> {
  const counts = user.isAdmin && user.isActive ? 1 : 0;

  return (await users.countActiveAdmins()) - counts < 1;
}
