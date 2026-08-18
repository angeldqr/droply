import type { Clock } from '../../shared/clock';
import type { InvalidInputError } from '../../shared/domain-error';
import {
  LibraryItemId,
  type IdGenerator,
  type LibraryId,
  type UserId,
} from '../../shared/identifiers';
import { err, ok, type Result } from '../../shared/result';
import { ItemMoveImpossible, ItemNotFound, LibraryNotFound } from '../domain/errors';
import { LibraryItem } from '../domain/library-item';
import type { LibraryItemRepository, LibraryRepository, MediaStorage } from '../domain/ports';
import { needsRebalance, positionAtEnd, positionBetween, rebalanced } from '../domain/position';

export class AddTextItem {
  constructor(
    private readonly libraries: LibraryRepository,
    private readonly items: LibraryItemRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(
    ownerId: UserId,
    libraryId: LibraryId,
    text: string,
  ): Promise<Result<LibraryItem, LibraryNotFound | InvalidInputError>> {
    const library = await this.libraries.findOwned(libraryId, ownerId);
    if (!library) return err(new LibraryNotFound());

    const now = this.clock.now();

    // Al final de su columna, que es donde el botón de agregar espera al
    // usuario en la pantalla.
    const item = LibraryItem.text({
      id: LibraryItemId.from(this.ids.generate()),
      libraryId,
      position: positionAtEnd(await this.items.lastPositionOf(libraryId, 'TEXT')),
      text,
      now,
    });

    if (!item.ok) return item;

    await this.items.add(item.value);

    library.touch(now);
    await this.libraries.save(library);

    return ok(item.value);
  }
}

export class RemoveItem {
  constructor(
    private readonly libraries: LibraryRepository,
    private readonly items: LibraryItemRepository,
    private readonly storage: MediaStorage,
    private readonly clock: Clock,
  ) {}

  async execute(
    ownerId: UserId,
    libraryId: LibraryId,
    itemId: LibraryItemId,
  ): Promise<Result<void, LibraryNotFound | ItemNotFound>> {
    const library = await this.libraries.findOwned(libraryId, ownerId);
    if (!library) return err(new LibraryNotFound());

    const item = await this.items.findInLibrary(itemId, libraryId);
    if (!item) return err(new ItemNotFound());

    // Este es el único camino por el que se quita un elemento, así que es el
    // único lugar donde hay que acordarse del archivo. El objeto va primero: si
    // fallara después de borrar la fila, quedaría suelto y sin nada que lo
    // apunte.
    if (item.storageKey) await this.storage.remove(item.storageKey);

    await this.items.remove(itemId, libraryId);

    library.touch(this.clock.now());
    await this.libraries.save(library);

    return ok();
  }
}

export interface MoveTarget {
  readonly afterItemId?: string | null | undefined;
  readonly beforeItemId?: string | null | undefined;
}

export class MoveItem {
  constructor(
    private readonly libraries: LibraryRepository,
    private readonly items: LibraryItemRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    ownerId: UserId,
    libraryId: LibraryId,
    itemId: LibraryItemId,
    target: MoveTarget,
  ): Promise<Result<void, LibraryNotFound | ItemNotFound | ItemMoveImpossible>> {
    const library = await this.libraries.findOwned(libraryId, ownerId);
    if (!library) return err(new LibraryNotFound());

    const all = await this.items.listOf(libraryId);
    const moving = all.find((candidate) => candidate.id === itemId);
    if (!moving) return err(new ItemNotFound());

    const neighbours = this.resolveNeighbours(all, moving, target);
    if (!neighbours.ok) return neighbours;

    let { before, after } = neighbours.value;

    if (needsRebalance(before, after)) {
      /*
       * Los promedios sucesivos agotaron la precisión entre estos dos vecinos.
       * Se reparten posiciones nuevas y bien separadas para toda la columna.
       *
       * Se rebalancea una sola vez, sin recursión: si los dos vecinos fueran el
       * mismo elemento, la distancia entre ellos sería cero por más que se
       * repartan posiciones, y reintentar sería un bucle infinito escribiendo
       * en la base en cada vuelta. El esquema ya rechaza ese caso, pero el
       * dominio no se apoya en que alguien más haya validado.
       */
      const spread = this.spreadOut(all, moving);
      await this.items.savePositions(spread);

      const recalculated = this.resolveNeighbours(spread, moving, target);
      if (!recalculated.ok) return recalculated;

      ({ before, after } = recalculated.value);

      if (needsRebalance(before, after)) {
        return err(new ItemMoveImpossible());
      }
    }

    moving.moveTo(positionBetween(before, after));
    await this.items.savePositions([moving]);

    library.touch(this.clock.now());
    await this.libraries.save(library);

    return ok();
  }

  /**
   * Un movimiento se expresa por sus vecinos. Los dos tienen que estar en la
   * misma columna que el elemento: no se arrastra un texto a la columna de
   * audios.
   */
  private resolveNeighbours(
    all: readonly LibraryItem[],
    moving: LibraryItem,
    target: MoveTarget,
  ): Result<{ before: number | null; after: number | null }, ItemNotFound> {
    const sameColumn = (id: string | null | undefined) =>
      id ? all.find((item) => item.id === id && item.kind === moving.kind) : undefined;

    const before = sameColumn(target.afterItemId);
    const after = sameColumn(target.beforeItemId);

    if (target.afterItemId && !before) return err(new ItemNotFound());
    if (target.beforeItemId && !after) return err(new ItemNotFound());

    return ok({ before: before?.position ?? null, after: after?.position ?? null });
  }

  private spreadOut(all: readonly LibraryItem[], moving: LibraryItem): LibraryItem[] {
    const column = all
      .filter((item) => item.kind === moving.kind)
      .sort((left, right) => left.position - right.position);

    const positions = rebalanced(column.length);

    column.forEach((item, index) => item.moveTo(positions[index]!));

    return column;
  }
}
