import type { Clock } from '../../shared/clock';
import { err, ok, type Result } from '../../shared/result';
import { SessionCompromised, SessionExpired } from '../domain/errors';
import type { RefreshTokenRepository, SecretTokenFactory, UserRepository } from '../domain/ports';
import type { AuthenticatedSession, SessionIssuer } from './session-issuer';

/**
 * Cuánto después de canjearse un token se lo toma por otra pestaña y no por un
 * robo. Al reabrir el navegador con varias pestañas, cada una manda la misma
 * cookie en el mismo instante; la que pierde reintenta a los 400 ms (`lib/api.ts`
 * de la web), ya con la cookie nueva que dejó la que ganó.
 *
 * Corto a propósito: si quien robó el token lo canjea primero y la víctima llega
 * dentro del margen, la familia no cae. Cinco segundos sobran para las pestañas
 * y dejan muy poco para eso.
 */
export const CONCURRENT_REFRESH_GRACE_MS = 5_000;

export class RefreshSessionUseCase {
  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly users: UserRepository,
    private readonly secrets: SecretTokenFactory,
    private readonly sessions: SessionIssuer,
    private readonly clock: Clock,
  ) {}

  async execute(presented: string): Promise<Result<AuthenticatedSession, SessionExpired>> {
    const stored = await this.refreshTokens.findByHash(this.secrets.hash(presented));

    if (!stored) return err(new SessionExpired());

    const now = this.clock.now();
    const verdict = stored.classify(now);

    switch (verdict) {
      case 'reused': {
        /*
         * Canjeado hace un instante: otra pestaña del mismo navegador. Se
         * rechaza sin tumbar la familia. Quien robó el token tampoco obtiene
         * sesión en ese margen; solo no consigue cerrarla.
         */
        if (stored.rotatedWithin(now, CONCURRENT_REFRESH_GRACE_MS)) {
          return err(new SessionExpired());
        }

        /*
         * Este token ya se canjeó una vez y alguien lo está presentando de
         * nuevo. O se filtró, o el cliente legítimo reintentó; no hay forma de
         * saber cuál desde acá, así que se asume lo peor.
         *
         * Cae la familia entera, no solo este token: el atacante ya podría
         * tener en la mano el token rotado, y revocar solo el viejo lo dejaría
         * adentro.
         */
        await this.refreshTokens.revokeFamily(stored.familyId, now);
        return err(new SessionCompromised());
      }

      case 'revoked':
      case 'expired':
        return err(new SessionExpired());

      case 'active':
        break;
    }

    const user = await this.users.findById(stored.userId);
    if (!user) return err(new SessionExpired());

    // Marcar la rotación antes de emitir el reemplazo: si algo falla en el
    // medio, el token viejo ya quedó quemado y no sirve dos veces.
    stored.markRotated(now);
    await this.refreshTokens.save(stored);

    return ok({ session: await this.sessions.continueSession(user, stored.familyId), user });
  }
}
