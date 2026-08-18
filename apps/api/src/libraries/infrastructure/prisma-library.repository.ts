import type { Library as LibraryRow } from '@prisma/client';
import type { PrismaService } from '../../platform/prisma/prisma.service';
import { LibraryId, UserId, type LibraryId as LibraryIdType } from '../../shared/identifiers';
import { emptyCounts, type ItemKind } from '../domain/item-kind';
import { Library } from '../domain/library';
import type { LibraryRepository } from '../domain/ports';

export class PrismaLibraryRepository implements LibraryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listOwnedBy(
    ownerId: UserId,
  ): Promise<{ library: Library; counts: Record<ItemKind, number> }[]> {
    const rows = await this.prisma.library.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' },
    });

    if (rows.length === 0) return [];

    // Una sola consulta agrupada para todas las bibliotecas, en vez de una por
    // cada una: con veinte bibliotecas serían veintiuna consultas.
    const grouped = await this.prisma.libraryItem.groupBy({
      by: ['libraryId', 'kind'],
      where: { libraryId: { in: rows.map((row) => row.id) } },
      _count: { _all: true },
    });

    const counts = new Map<string, Record<ItemKind, number>>();

    for (const row of grouped) {
      const forLibrary = counts.get(row.libraryId) ?? emptyCounts();
      forLibrary[row.kind] = row._count._all;
      counts.set(row.libraryId, forLibrary);
    }

    return rows.map((row) => ({
      library: toDomain(row),
      counts: counts.get(row.id) ?? emptyCounts(),
    }));
  }

  async findOwned(id: LibraryIdType, ownerId: UserId): Promise<Library | null> {
    // El dueño va en el `where`, no en un chequeo posterior.
    const row = await this.prisma.library.findFirst({ where: { id, ownerId } });

    return row ? toDomain(row) : null;
  }

  async add(library: Library): Promise<void> {
    const snapshot = library.toSnapshot();

    await this.prisma.library.create({
      data: {
        id: snapshot.id,
        ownerId: snapshot.ownerId,
        name: snapshot.name,
        description: snapshot.description,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt,
      },
    });
  }

  async save(library: Library): Promise<void> {
    const snapshot = library.toSnapshot();

    await this.prisma.library.update({
      where: { id: snapshot.id },
      data: {
        name: snapshot.name,
        description: snapshot.description,
        updatedAt: snapshot.updatedAt,
      },
    });
  }

  async remove(id: LibraryIdType, ownerId: UserId): Promise<void> {
    // Los elementos caen solos por la cascada de la clave foránea.
    await this.prisma.library.deleteMany({ where: { id, ownerId } });
  }
}

function toDomain(row: LibraryRow): Library {
  return Library.fromSnapshot({
    id: LibraryId.from(row.id),
    ownerId: UserId.from(row.ownerId),
    name: row.name,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
