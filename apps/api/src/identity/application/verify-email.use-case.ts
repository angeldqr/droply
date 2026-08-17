import type { Clock } from '../../shared/clock';
import { err, ok, type Result } from '../../shared/result';
import { VerificationLinkInvalid } from '../domain/errors';
import type {
  EmailVerificationRepository,
  SecretTokenFactory,
  UserRepository,
} from '../domain/ports';

export class VerifyEmailUseCase {
  constructor(
    private readonly verifications: EmailVerificationRepository,
    private readonly users: UserRepository,
    private readonly secrets: SecretTokenFactory,
    private readonly clock: Clock,
  ) {}

  async execute(token: string): Promise<Result<void, VerificationLinkInvalid>> {
    const record = await this.verifications.findByHash(this.secrets.hash(token));

    // Un enlace inexistente, uno ya usado y uno vencido dan el mismo error a
    // propósito: no hay nada que ganar contándole al visitante en cuál de los
    // tres casos cayó.
    if (!record) return err(new VerificationLinkInvalid());

    const now = this.clock.now();

    if (record.usedAt !== null) return err(new VerificationLinkInvalid());
    if (record.expiresAt.getTime() <= now.getTime()) return err(new VerificationLinkInvalid());

    const user = await this.users.findById(record.userId);
    if (!user) return err(new VerificationLinkInvalid());

    user.verifyEmail(now);

    await this.users.save(user);
    await this.verifications.markUsed(record.id, now);

    return ok();
  }
}
