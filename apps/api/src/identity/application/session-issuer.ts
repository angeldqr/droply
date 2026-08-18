import type { Clock } from '../../shared/clock';
import type { IdGenerator } from '../../shared/identifiers';
import type {
  AccessTokenIssuer,
  RefreshTokenRepository,
  SecretTokenFactory,
} from '../domain/ports';
import { RefreshToken } from '../domain/refresh-token';
import type { User } from '../domain/user';

export interface IssuedSession {
  readonly accessToken: string;
  readonly accessTokenExpiresInSeconds: number;
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: Date;
}

/**
 * Los tokens y de quién son. Quien atiende el HTTP necesita las dos cosas para
 * responder, y buscar al usuario de nuevo sería una consulta de más, cuando el
 * caso de uso ya lo tenía en la mano.
 */
export interface AuthenticatedSession {
  readonly session: IssuedSession;
  readonly user: User;
}

/**
 * Acuña el par de tokens de una sesión. Lo usan el login y el refresco, que
 * solo se diferencian en si abren una familia nueva o continúan la existente.
 */
export class SessionIssuer {
  constructor(
    private readonly accessTokens: AccessTokenIssuer,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly secrets: SecretTokenFactory,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly refreshLifetimeMs: number,
  ) {}

  /** Un login abre una cadena nueva. */
  async openSession(user: User): Promise<IssuedSession> {
    return this.mint(user, this.ids.generate());
  }

  /** Un refresco continúa la cadena, para no perder la trazabilidad. */
  async continueSession(user: User, familyId: string): Promise<IssuedSession> {
    return this.mint(user, familyId);
  }

  private async mint(user: User, familyId: string): Promise<IssuedSession> {
    const now = this.clock.now();
    const secret = this.secrets.create();
    const expiresAt = new Date(now.getTime() + this.refreshLifetimeMs);

    await this.refreshTokens.add(
      RefreshToken.issue({
        id: this.ids.generate(),
        userId: user.id,
        familyId,
        tokenHash: secret.hash,
        expiresAt,
      }),
    );

    const access = await this.accessTokens.issue({ userId: user.id });

    return {
      accessToken: access.token,
      accessTokenExpiresInSeconds: access.expiresInSeconds,
      refreshToken: secret.value,
      refreshTokenExpiresAt: expiresAt,
    };
  }
}
