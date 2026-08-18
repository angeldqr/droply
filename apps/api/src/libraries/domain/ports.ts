import type { LibraryId, LibraryItemId, UserId } from '../../shared/identifiers';
import type { ItemKind } from './item-kind';
import type { Library } from './library';
import type { LibraryItem } from './library-item';

/**
 * Todas las lecturas llevan `ownerId` en la firma, no como un chequeo posterior.
 * Así no existe la posibilidad de traer la biblioteca de otro y recordar tarde
 * que había que comprobar el dueño.
 */
export interface LibraryRepository {
  listOwnedBy(ownerId: UserId): Promise<{ library: Library; counts: Record<ItemKind, number> }[]>;
  findOwned(id: LibraryId, ownerId: UserId): Promise<Library | null>;
  add(library: Library): Promise<void>;
  save(library: Library): Promise<void>;
  remove(id: LibraryId, ownerId: UserId): Promise<void>;
}

export interface LibraryItemRepository {
  listOf(libraryId: LibraryId): Promise<LibraryItem[]>;
  findInLibrary(id: LibraryItemId, libraryId: LibraryId): Promise<LibraryItem | null>;
  lastPositionOf(libraryId: LibraryId, kind: ItemKind): Promise<number | null>;
  add(item: LibraryItem): Promise<void>;
  savePositions(items: readonly LibraryItem[]): Promise<void>;
  remove(id: LibraryItemId, libraryId: LibraryId): Promise<void>;
}

export const LIBRARY_REPOSITORY = Symbol('LibraryRepository');
export const LIBRARY_ITEM_REPOSITORY = Symbol('LibraryItemRepository');
