import type { PrismaService } from '../../platform/prisma/prisma.service';
import type { PlannedItem } from '../../shared/day-plan';
import type { LibraryId, RecipientId, UserId } from '../../shared/identifiers';
import type { ItemKind } from '../domain/item-kind';
import type {
  FixedItem,
  FixedItemRepository,
  LibraryDirectory,
  RecipientDirectory,
} from '../domain/ports';

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

  async planItemsOf(libraryId: LibraryId, kindFilter: ItemKind | null): Promise<PlannedItem[]> {
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
      // El orden del tablero viaja con el elemento: es lo que decide a qué
      // hora cae cuando dos piden salir el mismo número de veces.
      select: { id: true, timesPerDay: true, position: true },
    });

    return rows;
  }

  async itemsOf(
    libraryId: LibraryId,
    itemIds: readonly string[],
  ): Promise<{ id: string; kind: ItemKind; label: string }[]> {
    const rows = await this.prisma.libraryItem.findMany({
      // La biblioteca va en el `where`: un archivo de otra no vuelve, y quien
      // pregunta se entera comparando cuántos pidió con cuántos recibió.
      where: { id: { in: [...itemIds] }, libraryId },
      select: { id: true, kind: true, fileName: true, textContent: true },
    });

    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      // Un texto no tiene nombre de archivo, así que se muestra por su
      // principio, que es como se reconoce en el tablero.
      label: row.fileName ?? (row.textContent ?? '').slice(0, 60),
    }));
  }
}

/**
 * Los envíos fijos de un horario.
 *
 * `replace` borra y vuelve a escribir dentro de una transacción: la pantalla
 * manda la lista entera, y guardarla en dos pasos sin transacción dejaría al
 * horario un instante sin ninguno de sus envíos fijos —justo el instante en el
 * que el tick podría mirarlo.
 */
export class PrismaFixedItemRepository implements FixedItemRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listOf(scheduleId: string): Promise<FixedItem[]> {
    const rows = await this.prisma.scheduleFixedItem.findMany({
      where: { scheduleId },
      orderBy: { minute: 'asc' },
      select: { minute: true, itemId: true },
    });

    return rows;
  }

  async minutesOf(scheduleId: string): Promise<number[]> {
    const rows = await this.prisma.scheduleFixedItem.findMany({
      where: { scheduleId },
      select: { minute: true },
    });

    return rows.map((row) => row.minute);
  }

  async replace(scheduleId: string, items: readonly FixedItem[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.scheduleFixedItem.deleteMany({ where: { scheduleId } }),
      this.prisma.scheduleFixedItem.createMany({
        data: items.map((item) => ({ scheduleId, minute: item.minute, itemId: item.itemId })),
      }),
    ]);
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
