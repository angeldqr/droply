import type { InvalidInputError } from '../../shared/domain-error';
import type { Clock } from '../../shared/clock';
import { UserId, type IdGenerator } from '../../shared/identifiers';
import { err, ok, type Result } from '../../shared/result';
import { Email } from '../domain/email';
import { EmailAlreadyRegistered } from '../domain/errors';
import { PlainPassword } from '../domain/password';
import type { PasswordHasher, UserRepository } from '../domain/ports';
import { User } from '../domain/user';
import type { VerificationSender } from './verification-sender';

export interface RegisterUserInput {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
  readonly timezone: string;
}

export interface RegisterUserOutput {
  readonly userId: string;
}

export class RegisterUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly sender: VerificationSender,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
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
    await this.sender.sendTo(user.value);

    return ok({ userId: user.value.id });
  }
}
