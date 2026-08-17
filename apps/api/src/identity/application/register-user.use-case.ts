import type { InvalidInputError } from '../../shared/domain-error';
import type { Clock } from '../../shared/clock';
import { UserId, type IdGenerator } from '../../shared/identifiers';
import { err, ok, type Result } from '../../shared/result';
import { Email } from '../domain/email';
import { EmailAlreadyRegistered } from '../domain/errors';
import { PlainPassword } from '../domain/password';
import type {
  EmailVerificationRepository,
  Mailer,
  PasswordHasher,
  SecretTokenFactory,
  UserRepository,
} from '../domain/ports';
import { User } from '../domain/user';

export interface RegisterUserInput {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
  readonly timezone: string;
}

export interface RegisterUserOutput {
  readonly userId: string;
}

/** Una hora alcanza para abrir un correo; más tiempo solo agranda la ventana. */
const VERIFICATION_LIFETIME_MS = 60 * 60 * 1000;

export class RegisterUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly verifications: EmailVerificationRepository,
    private readonly hasher: PasswordHasher,
    private readonly secrets: SecretTokenFactory,
    private readonly mailer: Mailer,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly webUrl: string,
  ) {}

  async execute(
    input: RegisterUserInput,
  ): Promise<Result<RegisterUserOutput, InvalidInputError | EmailAlreadyRegistered>> {
    const email = Email.create(input.email);
    if (!email.ok) return email;

    const password = PlainPassword.create(input.password);
    if (!password.ok) return password;

    // Este chequeo no reemplaza al índice único de la base: entre esta consulta
    // y el insert cabe otro registro con el mismo correo. Sirve para dar un
    // mensaje claro en el caso normal; el que garantiza la unicidad de verdad
    // es el repositorio, que traduce la violación del índice al mismo error.
    if (await this.users.findByEmail(email.value)) {
      return err(new EmailAlreadyRegistered());
    }

    const now = this.clock.now();
    const passwordHash = await this.hasher.hash(password.value.reveal());

    const user = User.register({
      id: UserId.from(this.ids.generate()),
      email: email.value,
      passwordHash,
      displayName: input.displayName,
      timezone: input.timezone,
      now,
    });
    if (!user.ok) return user;

    await this.users.add(user.value);
    await this.sendVerification(user.value, now);

    return ok({ userId: user.value.id });
  }

  private async sendVerification(user: User, now: Date): Promise<void> {
    const secret = this.secrets.create();

    await this.verifications.add({
      id: this.ids.generate(),
      userId: user.id,
      tokenHash: secret.hash,
      expiresAt: new Date(now.getTime() + VERIFICATION_LIFETIME_MS),
      usedAt: null,
    });

    await this.mailer.sendVerification({
      to: user.email,
      displayName: user.displayName,
      verificationUrl: `${this.webUrl}/verificar-correo?token=${secret.value}`,
    });
  }
}
