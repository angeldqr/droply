import { jwtVerify, SignJWT } from 'jose';
import { UserId } from '../../shared/identifiers';
import type { AccessTokenClaims, AccessTokenIssuer } from '../domain/ports';

const ISSUER = 'reconectate';
const AUDIENCE = 'reconectate-web';

export class JwtAccessTokenIssuer implements AccessTokenIssuer {
  private readonly key: Uint8Array;

  constructor(
    secret: string,
    private readonly lifetime: string,
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  async issue(claims: AccessTokenClaims): Promise<{ token: string; expiresInSeconds: number }> {
    const issuedAt = Math.floor(Date.now() / 1000);

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(claims.userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt(issuedAt)
      .setExpirationTime(this.lifetime)
      .sign(this.key);

    return { token, expiresInSeconds: await this.remainingSeconds(token, issuedAt) };
  }

  async verify(token: string): Promise<AccessTokenClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: ['HS256'],
      });

      if (!payload.sub || !UserId.is(payload.sub)) return null;

      return { userId: payload.sub };
    } catch {
      // Firma inválida, vencido, emisor equivocado: para quien llama es todo
      // lo mismo, un token que no sirve.
      return null;
    }
  }

  /**
   * `jose` acepta duraciones como "15m", así que la expiración real la calcula
   * él. En vez de reimplementar ese parseo, se lee del token ya firmado.
   */
  private async remainingSeconds(token: string, issuedAt: number): Promise<number> {
    const { payload } = await jwtVerify(token, this.key, { issuer: ISSUER, audience: AUDIENCE });

    return typeof payload.exp === 'number' ? payload.exp - issuedAt : 0;
  }
}
