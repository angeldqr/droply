import type { UserId } from '../../shared/identifiers';

export interface RefreshTokenSnapshot {
  readonly id: string;
  readonly userId: UserId;
  readonly familyId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly rotatedAt: Date | null;
  readonly revokedAt: Date | null;
}

/**
 * En qué situación llegó un token que alguien acaba de presentar.
 *
 * `reused` es el caso interesante: el token existe pero ya se canjeó antes.
 * Eso significa que dos partes tienen la misma cadena, y solo hay dos formas
 * de llegar ahí — alguien copió el token, o el cliente legítimo reintentó. No
 * hay manera de distinguirlas, así que se asume lo peor y se tira abajo la
 * familia entera. El usuario vuelve a entrar; el atacante también pierde.
 */
export type TokenVerdict = 'active' | 'reused' | 'revoked' | 'expired';

export class RefreshToken {
  private constructor(
    readonly id: string,
    readonly userId: UserId,
    readonly familyId: string,
    readonly tokenHash: string,
    readonly expiresAt: Date,
    private rotatedAt: Date | null,
    private revokedAt: Date | null,
  ) {}

  /** Primer token de una cadena nueva: nace de un login. */
  static issue(input: {
    id: string;
    userId: UserId;
    familyId: string;
    tokenHash: string;
    expiresAt: Date;
  }): RefreshToken {
    return new RefreshToken(
      input.id,
      input.userId,
      input.familyId,
      input.tokenHash,
      input.expiresAt,
      null,
      null,
    );
  }

  static fromSnapshot(snapshot: RefreshTokenSnapshot): RefreshToken {
    return new RefreshToken(
      snapshot.id,
      snapshot.userId,
      snapshot.familyId,
      snapshot.tokenHash,
      snapshot.expiresAt,
      snapshot.rotatedAt,
      snapshot.revokedAt,
    );
  }

  classify(now: Date): TokenVerdict {
    // El orden importa: un token robado y ya usado tiene que salir como
    // `reused` aunque además esté vencido, porque la reacción es distinta.
    if (this.rotatedAt !== null) return 'reused';
    if (this.revokedAt !== null) return 'revoked';
    if (this.expiresAt.getTime() <= now.getTime()) return 'expired';
    return 'active';
  }

  markRotated(now: Date): void {
    this.rotatedAt = now;
  }

  toSnapshot(): RefreshTokenSnapshot {
    return {
      id: this.id,
      userId: this.userId,
      familyId: this.familyId,
      tokenHash: this.tokenHash,
      expiresAt: this.expiresAt,
      rotatedAt: this.rotatedAt,
      revokedAt: this.revokedAt,
    };
  }
}
