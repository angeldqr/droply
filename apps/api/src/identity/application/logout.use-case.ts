import type { Clock } from '../../shared/clock';
import { ok, type Result } from '../../shared/result';
import type { RefreshTokenRepository, SecretTokenFactory } from '../domain/ports';

export class LogoutUseCase {
  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly secrets: SecretTokenFactory,
    private readonly clock: Clock,
  ) {}

  /**
   * Cierra la cadena completa, no solo el token presentado: salir en un
   * dispositivo tiene que invalidar también el refresco que ya estaba en vuelo.
   *
   * Nunca falla. Si el token no existe o ya venció, el usuario igual quería
   * salir y ya está afuera; devolver un error solo lo confundiría.
   */
  async execute(presented: string | undefined): Promise<Result<void, never>> {
    if (!presented) return ok();

    const stored = await this.refreshTokens.findByHash(this.secrets.hash(presented));
    if (!stored) return ok();

    await this.refreshTokens.revokeFamily(stored.familyId, this.clock.now());

    return ok();
  }
}
