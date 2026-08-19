import type { PrismaService } from '../../platform/prisma/prisma.service';
import { UserId } from '../../shared/identifiers';
import type { PasswordResetRecord, PasswordResetRepository } from '../domain/ports';

export class PrismaPasswordResetRepository implements PasswordResetRepository {
  constructor(private readonly prisma: PrismaService) {}

  async add(record: PasswordResetRecord & { tokenHash: string }): Promise<void> {
    await this.prisma.passwordReset.create({
      data: {
        id: record.id,
        userId: record.userId,
        tokenHash: record.tokenHash,
        expiresAt: record.expiresAt,
      },
    });
  }

  async findByHash(tokenHash: string): Promise<PasswordResetRecord | null> {
    const row = await this.prisma.passwordReset.findUnique({ where: { tokenHash } });

    if (!row) return null;

    return {
      id: row.id,
      userId: UserId.from(row.userId),
      expiresAt: row.expiresAt,
      usedAt: row.usedAt,
    };
  }

  async markUsed(id: string, now: Date): Promise<void> {
    await this.prisma.passwordReset.update({ where: { id }, data: { usedAt: now } });
  }
}
