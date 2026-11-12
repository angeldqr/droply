import type { PrismaService } from '../../platform/prisma/prisma.service';
import type { UserId } from '../../shared/identifiers';
import type { AccountProfile, AccountReader } from '../domain/ports';

export class PrismaAssistantAccountReader implements AccountReader {
  constructor(private readonly prisma: PrismaService) {}

  async profileOf(ownerId: UserId): Promise<AccountProfile> {
    const row = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { displayName: true, timezone: true },
    });

    // Sin fila solo pasa sin cuenta, y con sesión no pasa. Es el mismo respaldo de Mi bitácora.
    return { name: row?.displayName ?? '', timezone: row?.timezone ?? 'UTC' };
  }
}
