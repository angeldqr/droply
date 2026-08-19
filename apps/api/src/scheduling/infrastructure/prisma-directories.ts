import type { PrismaService } from '../../platform/prisma/prisma.service';
import type { LibraryId, RecipientId, UserId } from '../../shared/identifiers';
import type { ItemKind } from '../domain/item-kind';
import type { LibraryDirectory, RecipientDirectory } from '../domain/ports';

/**
 * Los dos datos que scheduling necesita de los otros contextos: cómo se llama
 * la biblioteca y si el destinatario ya está vinculado.
 *
 * Se leen de la base directamente, sin importar `libraries` ni `recipients`:
 * un contexto no importa del dominio de otro, y montar un puente de módulos de
 * Nest para dos columnas sería más cableado que provecho. El dueño va en el
 * `where` en los dos casos, igual que en el repositorio de cada contexto.
 */
export class PrismaLibraryDirectory implements LibraryDirectory {
  constructor(private readonly prisma: PrismaService) {}

  async nameOf(libraryId: LibraryId, ownerId: UserId): Promise<string | null> {
    const row = await this.prisma.library.findFirst({
      // El baúl no se programa: es de donde se saca, no lo que se envía.
      where: { id: libraryId, ownerId, isVault: false },
      select: { name: true },
    });

    return row?.name ?? null;
  }

  async allows(libraryId: LibraryId, recipientId: RecipientId): Promise<boolean> {
    const row = await this.prisma.libraryRecipient.findUnique({
      where: { libraryId_recipientId: { libraryId, recipientId } },
      select: { libraryId: true },
    });

    return row !== null;
  }

  async sendTimesOf(libraryId: LibraryId, kindFilter: ItemKind | null): Promise<number[]> {
    const rows = await this.prisma.libraryItem.findMany({
      where: {
        libraryId,
        ...(kindFilter === null ? {} : { kind: kindFilter }),
        /*
         * Un archivo a medio subir no se puede enviar, así que tampoco tiene
         * que abrir un hueco en la rejilla. Los textos no tienen subida y por
         * eso entran siempre.
         */
        OR: [{ storageKey: null }, { mediaReadyAt: { not: null } }],
      },
      select: { timesPerDay: true },
    });

    return rows.map((row) => row.timesPerDay);
  }
}

export class PrismaRecipientDirectory implements RecipientDirectory {
  constructor(private readonly prisma: PrismaService) {}

  async find(
    recipientId: RecipientId,
    ownerId: UserId,
  ): Promise<{ label: string; isLinked: boolean } | null> {
    const row = await this.prisma.recipient.findFirst({
      where: { id: recipientId, ownerId },
      select: { label: true, verifiedAt: true, externalId: true },
    });

    if (!row) return null;

    return { label: row.label, isLinked: row.verifiedAt !== null && row.externalId !== null };
  }
}
