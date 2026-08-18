import type { Clock } from '../../shared/clock';
import type { InvalidInputError } from '../../shared/domain-error';
import { LibraryId, type IdGenerator, type UserId } from '../../shared/identifiers';
import { err, ok, type Result } from '../../shared/result';
import { LibraryNotFound } from '../domain/errors';
import type { ItemKind } from '../domain/item-kind';
import { Library } from '../domain/library';
import type { LibraryItem } from '../domain/library-item';
import type { LibraryItemRepository, LibraryRepository } from '../domain/ports';

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
  ): Promise<Result<Library, InvalidInputError>> {
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

export class GetLibrary {
  constructor(
    private readonly libraries: LibraryRepository,
    private readonly items: LibraryItemRepository,
  ) {}

  async execute(
    ownerId: UserId,
    libraryId: LibraryId,
  ): Promise<Result<{ library: Library; items: LibraryItem[] }, LibraryNotFound>> {
    const library = await this.libraries.findOwned(libraryId, ownerId);
    if (!library) return err(new LibraryNotFound());

    return ok({ library, items: await this.items.listOf(libraryId) });
  }
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
  ): Promise<Result<Library, LibraryNotFound | InvalidInputError>> {
    const library = await this.libraries.findOwned(libraryId, ownerId);
    if (!library) return err(new LibraryNotFound());

    const renamed = library.rename(fields.name, fields.description, this.clock.now());
    if (!renamed.ok) return renamed;

    await this.libraries.save(library);

    return ok(library);
  }
}

export class DeleteLibrary {
  constructor(private readonly libraries: LibraryRepository) {}

  async execute(ownerId: UserId, libraryId: LibraryId): Promise<Result<void, LibraryNotFound>> {
    const library = await this.libraries.findOwned(libraryId, ownerId);
    if (!library) return err(new LibraryNotFound());

    await this.libraries.remove(libraryId, ownerId);

    return ok();
  }
}
