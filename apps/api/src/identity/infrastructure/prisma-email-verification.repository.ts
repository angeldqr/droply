import type { PrismaService } from '../../platform/prisma/prisma.service';
import { UserId } from '../../shared/identifiers';
import type { EmailVerificationRecord, EmailVerificationRepository } from '../domain/ports';

export class PrismaEmailVerificationRepository implements EmailVerificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async add(record: EmailVerificationRecord & { tokenHash: string }): Promise<void> {
    await this.prisma.emailVerification.create({
      data: {
        id: record.id,
        userId: record.userId,
        tokenHash: record.tokenHash,
        expiresAt: record.expiresAt,
      },
    });
  }

  async findByHash(tokenHash: string): Promise<EmailVerificationRecord | null> {
    const row = await this.prisma.emailVerification.findUnique({ where: { tokenHash } });

    if (!row) return null;

    return {
      id: row.id,
      userId: UserId.from(row.userId),
      expiresAt: row.expiresAt,
      usedAt: row.usedAt,
    };
  }

  async markUsed(id: string, now: Date): Promise<void> {
    await this.prisma.emailVerification.update({ where: { id }, data: { usedAt: now } });
  }
}
