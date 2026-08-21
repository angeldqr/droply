import type { Clock } from '../../shared/clock';
import type { InvalidInputError } from '../../shared/domain-error';
import {
  LibraryId,
  type IdGenerator,
  type LibraryItemId,
  type UserId,
} from '../../shared/identifiers';
import { err, ok, type Result } from '../../shared/result';
import { LibraryNotFound, TooManyLibraries, VaultNotEditable } from '../domain/errors';
import type { ItemKind } from '../domain/item-kind';
import { Library, MAX_PER_ACCOUNT } from '../domain/library';
import type { LibraryItem } from '../domain/library-item';
import type { LibraryItemRepository, LibraryRepository, MediaStorage } from '../domain/ports';
import { mediaPrefixOf } from './media-use-cases';

export interface LibraryFields {
  readonly name: string;
  readonly description?: string | undefined;
}

export interface LibraryWithCounts {
  readonly library: Library;
  readonly counts: Record<ItemKind, number>;
}

export class CreateLibrary {
  constructor(
    private readonly libraries: LibraryRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(
    ownerId: UserId,
    fields: LibraryFields,
  ): Promise<Result<Library, InvalidInputError | TooManyLibraries>> {
    // El tope se cuenta acá y no en un guard: es una regla del negocio, y en un
    // guard quedaría fuera de los tests del caso de uso. La lista propia ya
    // está acotada por este mismo número, así que contarla no cuesta nada.
    if ((await this.libraries.listOwnedBy(ownerId)).length >= MAX_PER_ACCOUNT) {
      return err(new TooManyLibraries(MAX_PER_ACCOUNT));
    }

    const library = Library.create({
      id: LibraryId.from(this.ids.generate()),
      ownerId,
      name: fields.name,
      description: fields.description,
      now: this.clock.now(),
    });

    if (!library.ok) return library;

    await this.libraries.add(library.value);

    return ok(library.value);
  }
}

export class ListLibraries {
  constructor(private readonly libraries: LibraryRepository) {}

  execute(ownerId: UserId): Promise<LibraryWithCounts[]> {
    return this.libraries.listOwnedBy(ownerId);
  }
}

export interface LibraryContents {
  readonly library: Library;
  readonly items: LibraryItem[];
  /** Solo los elementos verificados: hasta entonces no hay nada que mostrar. */
  readonly mediaLinks: ReadonlyMap<LibraryItemId, string>;
}

export class GetLibrary {
  constructor(
    private readonly libraries: LibraryRepository,
    private readonly items: LibraryItemRepository,
    private readonly storage: MediaStorage,
  ) {}

  async execute(
    ownerId: UserId,
    libraryId: LibraryId,
  ): Promise<Result<LibraryContents, LibraryNotFound>> {
    const library = await this.libraries.findOwned(libraryId, ownerId);
    if (!library) return err(new LibraryNotFound());

    const items = await this.items.listOf(libraryId);

    return ok({ library, items, mediaLinks: await signLinks(items, this.storage) });
  }
}

/**
 * Una URL firmada por cada elemento verificado. Firmar es criptografía local,
 * no una ida y vuelta por cada uno.
 */
export async function signLinks(
  items: readonly LibraryItem[],
  storage: MediaStorage,
): Promise<ReadonlyMap<LibraryItemId, string>> {
  const links = new Map<LibraryItemId, string>();

  for (const item of items) {
    if (item.storageKey && item.isReady) {
      links.set(item.id, await storage.linkTo(item.storageKey));
    }
  }

  return links;
}

export class RenameLibrary {
  constructor(
    private readonly libraries: LibraryRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    ownerId: UserId,
    libraryId: LibraryId,
    fields: LibraryFields,
  ): Promise<Result<Library, LibraryNotFound | VaultNotEditable | InvalidInputError>> {
    const library = await this.libraries.findOwned(libraryId, ownerId);
    if (!library) return err(new LibraryNotFound());
    if (library.isVault) return err(new VaultNotEditable());

    const renamed = library.rename(fields.name, fields.description, this.clock.now());
    if (!renamed.ok) return renamed;

    await this.libraries.save(library);

    return ok(library);
  }
}

export class DeleteLibrary {
  constructor(
    private readonly libraries: LibraryRepository,
    private readonly storage: MediaStorage,
  ) {}

  async execute(
    ownerId: UserId,
    libraryId: LibraryId,
  ): Promise<Result<void, LibraryNotFound | VaultNotEditable>> {
    const library = await this.libraries.findOwned(libraryId, ownerId);
    if (!library) return err(new LibraryNotFound());
    if (library.isVault) return err(new VaultNotEditable());

    // La cascada de la clave foránea limpia Postgres, pero no sabe nada del
    // almacenamiento: sin esto, los archivos de la biblioteca quedarían ahí
    // para siempre, ocupando disco y sin nada que los apunte.
    await this.storage.removeUnder(mediaPrefixOf(ownerId, libraryId));

    await this.libraries.remove(libraryId, ownerId);

    return ok();
  }
}
