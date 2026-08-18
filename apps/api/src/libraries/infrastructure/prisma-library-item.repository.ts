import type { LibraryItem as ItemRow } from '@prisma/client';
import type { PrismaService } from '../../platform/prisma/prisma.service';
import { LibraryId, LibraryItemId } from '../../shared/identifiers';
import type { ItemKind } from '../domain/item-kind';
import { LibraryItem } from '../domain/library-item';
import type { LibraryItemRepository } from '../domain/ports';

export class PrismaLibraryItemRepository implements LibraryItemRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listOf(libraryId: LibraryId): Promise<LibraryItem[]> {
    const rows = await this.prisma.libraryItem.findMany({
      where: { libraryId },
      orderBy: [{ kind: 'asc' }, { position: 'asc' }],
    });

    return rows.map(toDomain);
  }

  async findInLibrary(id: LibraryItemId, libraryId: LibraryId): Promise<LibraryItem | null> {
    const row = await this.prisma.libraryItem.findFirst({ where: { id, libraryId } });

    return row ? toDomain(row) : null;
  }

  async lastPositionOf(libraryId: LibraryId, kind: ItemKind): Promise<number | null> {
    const row = await this.prisma.libraryItem.findFirst({
      where: { libraryId, kind },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    return row?.position ?? null;
  }

  async add(item: LibraryItem): Promise<void> {
    const snapshot = item.toSnapshot();

    await this.prisma.libraryItem.create({
      data: {
        id: snapshot.id,
        libraryId: snapshot.libraryId,
        kind: snapshot.kind,
        position: snapshot.position,
        textContent: snapshot.textContent,
        createdAt: snapshot.createdAt,
      },
    });
  }

  async savePositions(items: readonly LibraryItem[]): Promise<void> {
    if (items.length === 0) return;

    // En una transacción: un rebalanceo a medias dejaría la columna con
    // posiciones repetidas y un orden impredecible.
    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.libraryItem.update({
          where: { id: item.id },
          data: { position: item.position },
        }),
      ),
    );
  }

  async remove(id: LibraryItemId, libraryId: LibraryId): Promise<void> {
    await this.prisma.libraryItem.deleteMany({ where: { id, libraryId } });
  }
}

function toDomain(row: ItemRow): LibraryItem {
  return LibraryItem.fromSnapshot({
    id: LibraryItemId.from(row.id),
    libraryId: LibraryId.from(row.libraryId),
    kind: row.kind,
    position: row.position,
    textContent: row.textContent,
    createdAt: row.createdAt,
  });
}
