import type { PrismaService } from '../../platform/prisma/prisma.service';
import { offsetOf, type Page } from '../../shared/page';
import type { UserId } from '../../shared/identifiers';
import type { AccountDetail, AccountDirectory, AccountSummary } from '../domain/ports';

/**
 * Las lecturas del panel de administración.
 *
 * Cada consulta nombra las columnas que devuelve en vez de traer la fila
 * entera: así el hash de la contraseña, el contenido de los textos y las claves
 * del almacenamiento no pueden colarse en una respuesta por descuido.
 */
export class PrismaAccountDirectory implements AccountDirectory {
  constructor(private readonly prisma: PrismaService) {}

  async list(page: number, pageSize: number): Promise<Page<AccountSummary>> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        // El `id` desempata dos cuentas creadas en el mismo instante.
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: offsetOf(page, pageSize),
        take: pageSize,
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          emailVerifiedAt: true,
          deactivatedAt: true,
          createdAt: true,
          _count: { select: { recipients: true, schedules: true } },
          libraries: { select: { isVault: true, _count: { select: { items: true } } } },
        },
      }),
      this.prisma.user.count(),
    ]);

    const items = rows.map((row) => ({
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      role: row.role,
      emailVerified: row.emailVerifiedAt !== null,
      active: row.deactivatedAt === null,
      createdAt: row.createdAt,
      // El baúl no cuenta como biblioteca: no se envía ni se lista con ellas.
      libraryCount: row.libraries.filter((library) => !library.isVault).length,
      recipientCount: row._count.recipients,
      scheduleCount: row._count.schedules,
      vaultItemCount: row.libraries
        .filter((library) => library.isVault)
        .reduce((total, library) => total + library._count.items, 0),
    }));

    return { items, total };
  }

  async find(userId: UserId): Promise<AccountDetail | null> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        emailVerifiedAt: true,
        deactivatedAt: true,
        createdAt: true,
        _count: { select: { recipients: true, schedules: true } },
        libraries: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            description: true,
            isVault: true,
            _count: { select: { items: true, recipients: true } },
          },
        },
        recipients: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, label: true, verifiedAt: true, externalId: true },
        },
      },
    });

    if (!row) return null;

    const libraries = row.libraries.filter((library) => !library.isVault);
    const vault = row.libraries.find((library) => library.isVault);

    return {
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      role: row.role,
      emailVerified: row.emailVerifiedAt !== null,
      active: row.deactivatedAt === null,
      createdAt: row.createdAt,
      libraryCount: libraries.length,
      recipientCount: row._count.recipients,
      scheduleCount: row._count.schedules,
      vaultItemCount: vault?._count.items ?? 0,
      libraries: libraries.map((library) => ({
        id: library.id,
        name: library.name,
        description: library.description,
        itemCount: library._count.items,
        recipientCount: library._count.recipients,
      })),
      recipients: row.recipients.map((recipient) => ({
        id: recipient.id,
        label: recipient.label,
        linked: recipient.verifiedAt !== null && recipient.externalId !== null,
      })),
    };
  }
}
