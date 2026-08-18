import type { LibraryId, LibraryItemId, UserId } from '../../shared/identifiers';
import { emptyCounts, type ItemKind } from '../domain/item-kind';
import type { Library } from '../domain/library';
import type { LibraryItem } from '../domain/library-item';
import type {
  LibraryItemRepository,
  LibraryRepository,
  MediaStorage,
  UploadTicket,
} from '../domain/ports';

export class InMemoryLibraryRepository implements LibraryRepository {
  readonly rows = new Map<string, Library>();

  constructor(private readonly items: InMemoryLibraryItemRepository) {}

  listOwnedBy(ownerId: UserId): Promise<{ library: Library; counts: Record<ItemKind, number> }[]> {
    const owned = [...this.rows.values()]
      .filter((library) => library.ownerId === ownerId)
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());

    return Promise.resolve(
      owned.map((library) => ({ library, counts: this.items.countsOf(library.id) })),
    );
  }

  findOwned(id: LibraryId, ownerId: UserId): Promise<Library | null> {
    const library = this.rows.get(id);

    // El dueño es parte de la búsqueda, igual que en el repositorio real.
    return Promise.resolve(library?.ownerId === ownerId ? library : null);
  }

  add(library: Library): Promise<void> {
    this.rows.set(library.id, library);

    return Promise.resolve();
  }

  save(library: Library): Promise<void> {
    this.rows.set(library.id, library);

    return Promise.resolve();
  }

  remove(id: LibraryId, ownerId: UserId): Promise<void> {
    const library = this.rows.get(id);

    if (library?.ownerId === ownerId) {
      this.rows.delete(id);
      this.items.removeAllOf(id);
    }

    return Promise.resolve();
  }
}

export class InMemoryLibraryItemRepository implements LibraryItemRepository {
  readonly rows = new Map<string, LibraryItem>();

  listOf(libraryId: LibraryId): Promise<LibraryItem[]> {
    return Promise.resolve(
      [...this.rows.values()]
        .filter((item) => item.libraryId === libraryId)
        .sort((left, right) => left.position - right.position),
    );
  }

  findInLibrary(id: LibraryItemId, libraryId: LibraryId): Promise<LibraryItem | null> {
    const item = this.rows.get(id);

    return Promise.resolve(item?.libraryId === libraryId ? item : null);
  }

  lastPositionOf(libraryId: LibraryId, kind: ItemKind): Promise<number | null> {
    const column = [...this.rows.values()].filter(
      (item) => item.libraryId === libraryId && item.kind === kind,
    );

    if (column.length === 0) return Promise.resolve(null);

    return Promise.resolve(Math.max(...column.map((item) => item.position)));
  }

  add(item: LibraryItem): Promise<void> {
    this.rows.set(item.id, item);

    return Promise.resolve();
  }

  save(item: LibraryItem): Promise<void> {
    this.rows.set(item.id, item);

    return Promise.resolve();
  }

  savePositions(items: readonly LibraryItem[]): Promise<void> {
    for (const item of items) this.rows.set(item.id, item);

    return Promise.resolve();
  }

  remove(id: LibraryItemId, libraryId: LibraryId): Promise<void> {
    const item = this.rows.get(id);
    if (item?.libraryId === libraryId) this.rows.delete(id);

    return Promise.resolve();
  }

  countsOf(libraryId: LibraryId): Record<ItemKind, number> {
    const counts = emptyCounts();

    for (const item of this.rows.values()) {
      if (item.libraryId === libraryId) counts[item.kind] += 1;
    }

    return counts;
  }

  removeAllOf(libraryId: LibraryId): void {
    for (const [id, item] of this.rows) {
      if (item.libraryId === libraryId) this.rows.delete(id);
    }
  }

  /** La columna en el orden en que la vería la pantalla. */
  columnOf(libraryId: LibraryId, kind: ItemKind): LibraryItem[] {
    return [...this.rows.values()]
      .filter((item) => item.libraryId === libraryId && item.kind === kind)
      .sort((left, right) => left.position - right.position);
  }
}

/**
 * El almacenamiento de mentira. Guarda los bytes que le pongan, así que un test
 * puede subir una cabecera de PNG a un elemento que dijo ser un MP3 y ver qué
 * hace la confirmación.
 */
export class InMemoryMediaStorage implements MediaStorage {
  readonly objects = new Map<string, Uint8Array>();
  /** Los permisos firmados, para comprobar con qué techo se firmaron. */
  readonly tickets = new Map<string, { mimeType: string; maxBytes: number }>();

  ticketFor(key: string, mimeType: string, maxBytes: number): Promise<UploadTicket> {
    this.tickets.set(key, { mimeType, maxBytes });

    return Promise.resolve({
      url: 'https://almacenamiento.invalido/droply-media',
      fields: { key, 'Content-Type': mimeType },
    });
  }

  /** Lo que haría el navegador al subir. */
  put(key: string, bytes: Uint8Array): void {
    this.objects.set(key, bytes);
  }

  inspect(key: string): Promise<{ sizeBytes: number; head: Uint8Array } | null> {
    const bytes = this.objects.get(key);

    return Promise.resolve(bytes ? { sizeBytes: bytes.length, head: bytes } : null);
  }

  linkTo(key: string): Promise<string> {
    return Promise.resolve(`https://almacenamiento.invalido/droply-media/${key}?firma=x`);
  }

  remove(key: string): Promise<void> {
    this.objects.delete(key);

    return Promise.resolve();
  }

  removeUnder(prefix: string): Promise<void> {
    for (const key of this.objects.keys()) {
      if (key.startsWith(prefix)) this.objects.delete(key);
    }

    return Promise.resolve();
  }
}
