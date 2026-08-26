import { Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Clock } from '../../shared/clock';
import { UserId, type IdGenerator } from '../../shared/identifiers';
import { Email } from '../domain/email';
import type { PasswordHasher, UserRepository } from '../domain/ports';
import { User } from '../domain/user';

export interface AdminBootstrapConfig {
  readonly email: string | undefined;
  readonly initialPassword: string | undefined;
  readonly timezone: string;
}

/**
 * Resuelve al arrancar quién administra, a partir del entorno.
 *
 * Sin registro abierto, la primera cuenta no la puede crear nadie desde la
 * aplicación. Dejarlo en el entorno pone esa decisión donde ya viven todas las
 * del despliegue, en vez de en un comando suelto que hay que acordarse de
 * ejecutar en cada máquina nueva.
 *
 * Es idempotente: si la cuenta ya está y ya administra, no toca nada. Por eso
 * la variable puede quedarse puesta para siempre sin hacer daño, y por eso
 * arreglar un despiste —alguien que se quitó el rol a sí mismo— es reiniciar.
 *
 * Nunca **quita** el rol a nadie. Si el correo cambia, el administrador
 * anterior sigue siéndolo: degradar cuentas por editar una variable sería una
 * forma demasiado silenciosa de dejar a alguien fuera.
 */
export class AdminBootstrap implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrap.name);

  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly config: AdminBootstrapConfig,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.email) return;

    const email = Email.create(this.config.email);

    if (!email.ok) {
      this.logger.error(`ADMIN_EMAIL no es un correo válido: ${this.config.email}`);

      return;
    }

    const existing = await this.users.findByEmail(email.value);

    if (existing) {
      if (existing.isAdmin) return;

      existing.promoteToAdmin();
      await this.users.save(existing);
      this.logger.log(`${this.config.email} ahora administra Reconéctate.`);

      return;
    }

    await this.create(email.value);
  }

  private async create(email: Email): Promise<void> {
    if (!this.config.initialPassword) {
      this.logger.error(
        `ADMIN_EMAIL apunta a una cuenta que no existe y no hay ADMIN_INITIAL_PASSWORD para crearla. Nadie puede administrar todavía.`,
      );

      return;
    }

    const now = this.clock.now();

    const user = User.register({
      id: UserId.from(this.ids.generate()),
      email,
      passwordHash: await this.hasher.hash(this.config.initialPassword),
      displayName: 'Administración',
      role: 'ADMIN',
      timezone: this.config.timezone,
      now,
    });

    if (!user.ok) {
      this.logger.error(`No se pudo crear la cuenta de administración: ${user.error.message}`);

      return;
    }

    /*
     * Nace con el correo ya confirmado. La confirmación existe para frenar a
     * quien se registra solo con una dirección desechable, y acá no hay
     * registro: la cuenta la declaró quien controla el entorno del servidor.
     * Además no habría a quién pedirle que abra el enlace todavía.
     */
    user.value.verifyEmail(now);

    await this.users.add(user.value);

    this.logger.log(`Cuenta de administración creada para ${email.value}.`);
  }
}
