import type { UserId } from '../../shared/identifiers';
import { ok, type Result } from '../../shared/result';
import type { UserRepository } from '../domain/ports';
import type { VerificationSender } from './verification-sender';

/**
 * Manda otra vez el enlace de confirmación.
 *
 * Va con sesión: quien pide el reenvío ya demostró ser el dueño de la cuenta al
 * entrar, así que no hace falta que escriba su correo y no hay forma de usar
 * esto para averiguar qué direcciones están registradas.
 *
 * No falla nunca. Si la cuenta ya está confirmada no manda nada y responde
 * igual: quien apretó el botón dos veces no necesita un error, y el estado que
 * quería ya es el que tiene.
 */
export class ResendVerificationUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly sender: VerificationSender,
  ) {}

  async execute(userId: UserId): Promise<Result<void, never>> {
    const user = await this.users.findById(userId);

    if (user && !user.isEmailVerified) {
      await this.sender.sendTo(user);
    }

    return ok();
  }
}
