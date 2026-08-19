import type { PrismaService } from '../../platform/prisma/prisma.service';
import { UserId } from '../../shared/identifiers';
import type { RefreshTokenRepository } from '../domain/ports';
import { RefreshToken } from '../domain/refresh-token';

export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!row) return null;

    return RefreshToken.fromSnapshot({
      id: row.id,
      userId: UserId.from(row.userId),
      familyId: row.familyId,
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt,
      rotatedAt: row.rotatedAt,
      revokedAt: row.revokedAt,
    });
  }

  async add(token: RefreshToken): Promise<void> {
    const snapshot = token.toSnapshot();

    await this.prisma.refreshToken.create({
      data: {
        id: snapshot.id,
        userId: snapshot.userId,
        familyId: snapshot.familyId,
        tokenHash: snapshot.tokenHash,
        expiresAt: snapshot.expiresAt,
      },
    });
  }

  async save(token: RefreshToken): Promise<void> {
    const snapshot = token.toSnapshot();

    await this.prisma.refreshToken.update({
      where: { id: snapshot.id },
      data: { rotatedAt: snapshot.rotatedAt, revokedAt: snapshot.revokedAt },
    });
  }

  async revokeFamily(familyId: string, now: Date): Promise<void> {
    // Solo los que siguen vivos: volver a sellar uno ya revocado borraría la
    // fecha real en que se cortó.
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  async revokeAllOf(userId: UserId, now: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });
  }
}
