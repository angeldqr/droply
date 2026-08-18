import type { PrismaService } from '../../platform/prisma/prisma.service';
import type { UserId } from '../../shared/identifiers';
import type { AccountStatus } from '../domain/ports';

/**
 * Se lee la columna directamente en vez de pedírselo a identity.
 *
 * Un contexto no importa de otro, y montar un puente de módulos de Nest para
 * responder un booleano sería más cableado que provecho. La consulta trae una
 * sola columna, así que tampoco arrastra el resto de la cuenta.
 */
export class PrismaAccountStatus implements AccountStatus {
  constructor(private readonly prisma: PrismaService) {}

  async hasVerifiedEmail(userId: UserId): Promise<boolean> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerifiedAt: true },
    });

    return row?.emailVerifiedAt != null;
  }
}
