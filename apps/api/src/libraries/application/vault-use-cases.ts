import type { Clock } from '../../shared/clock';
import type { InvalidInputError } from '../../shared/domain-error';
import { LibraryId, LibraryItemId, type IdGenerator, type UserId } from '../../shared/identifiers';
import { err, ok, type Result } from '../../shared/result';
import { ItemNotFound, LibraryNotFound, MediaNotUploaded } from '../domain/errors';
import { Library } from '../domain/library';
import { LibraryItem } from '../domain/library-item';
import type { LibraryItemRepository, LibraryRepository, MediaStorage } from '../domain/ports';
import { positionAtEnd } from '../domain/position';
import { signLinks, type LibraryContents } from './library-use-cases';
import { mediaKeyOf } from './media-use-cases';

/**
 * Abre el baúl de la cuenta y lo crea la primera vez que se pide.
 *
 * No se crea junto con la cuenta a propósito: una cuenta que nunca sube nada no
 * tendría por qué arrastrar una fila, y hacerlo acá evita tener que rellenar el
 * baúl de las cuentas que ya existen con una migración de datos.
 */
export class OpenVault {
  constructor(
    private readonly libraries: LibraryRepository,
    private readonly items: LibraryItemRepository,
    private readonly storage: MediaStorage,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(ownerId: UserId): Promise<LibraryContents> {
    const vault = (await this.libraries.findVaultOf(ownerId)) ?? (await this.createFor(ownerId));
    const items = await this.items.listOf(vault.id);

    return { library: vault, items, mediaLinks: await signLinks(items, this.storage) };
  }

  private async createFor(ownerId: UserId): Promise<Library> {
    const vault = Library.vault({
      id: LibraryId.from(this.ids.generate()),
      ownerId,
      now: this.clock.now(),
    });

    try {
      await this.libraries.add(vault);

      return vault;
    } catch (caught) {
      /*
       * Dos pestañas abiertas a la vez piden el baúl a la vez, y el índice
       * único parcial deja pasar solo a una. La otra no tiene por qué fallar:
       * el baúl que quería ya existe, así que lo lee y sigue.
       */
      const existing = await this.libraries.findVaultOf(ownerId);
      if (!existing) throw caught;

      return existing;
    }
  }
}

/**
 * Lleva uno o varios elementos del baúl a una biblioteca. Los originales se
 * quedan donde estaban: el baúl es de donde se saca, no de donde se mueve.
 *
 * Acepta una lista y no un elemento suelto porque de a uno era el problema:
 * había que abrir el diálogo, elegir, verlo cerrarse y volver a abrirlo por
 * cada archivo.
 *
 * **Primero se comprueba todo, después se copia nada.** Los cuatro motivos por
 * los que esto puede fallar —la biblioteca no es tuya, no hay baúl, el elemento
 * no está, el archivo se quedó a medias— se saben antes de escribir. Copiando
 * mientras se recorre, un elemento malo en la posición siete dejaría seis
 * copias hechas y un error en la pantalla, y nadie sabría qué entró.
 */
export class CopyFromVault {
  constructor(
    private readonly libraries: LibraryRepository,
    private readonly items: LibraryItemRepository,
    private readonly storage: MediaStorage,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(
    ownerId: UserId,
    libraryId: LibraryId,
    sourceItemIds: readonly LibraryItemId[],
  ): Promise<
    Result<LibraryItem[], LibraryNotFound | ItemNotFound | MediaNotUploaded | InvalidInputError>
  > {
    const library = await this.libraries.findOwned(libraryId, ownerId);

    // Copiar el baúl dentro del baúl no significa nada, y responde igual que
    // una biblioteca que no existe.
    if (!library || library.isVault) return err(new LibraryNotFound());

    const vault = await this.libraries.findVaultOf(ownerId);
    if (!vault) return err(new ItemNotFound());

    const sources: LibraryItem[] = [];

    for (const sourceItemId of sourceItemIds) {
      // El origen se busca dentro del baúl de quien pide, así que no hay forma
      // de nombrar el elemento de otra cuenta.
      const source = await this.items.findInLibrary(sourceItemId, vault.id);
      if (!source) return err(new ItemNotFound());

      // Lo que se quedó a medias en el baúl no tiene archivo que copiar. Se
      // dice ahora, antes de tocar el almacenamiento.
      if (source.kind !== 'TEXT' && (!source.storageKey || !source.isReady)) {
        return err(new MediaNotUploaded());
      }

      sources.push(source);
    }

    const now = this.clock.now();
    const copies: LibraryItem[] = [];

    /*
     * La última posición de cada columna se lleva acá y no se vuelve a
     * consultar: las copias todavía no están en la base cuando se calcula la
     * siguiente, así que preguntar otra vez devolvería el mismo número y las
     * cinco caerían en el mismo sitio.
     */
    const lastPositions = new Map<string, number>();

    for (const source of sources) {
      const previous =
        lastPositions.get(source.kind) ?? (await this.items.lastPositionOf(libraryId, source.kind));
      const position = positionAtEnd(previous);

      const copy = await this.copyOf(source, {
        id: LibraryItemId.from(this.ids.generate()),
        ownerId,
        libraryId,
        position,
        now,
      });

      if (!copy.ok) return copy;

      await this.items.add(copy.value);

      lastPositions.set(source.kind, position);
      copies.push(copy.value);
    }

    library.touch(now);
    await this.libraries.save(library);

    return ok(copies);
  }

  private async copyOf(
    source: LibraryItem,
    target: {
      id: LibraryItemId;
      ownerId: UserId;
      libraryId: LibraryId;
      position: number;
      now: Date;
    },
  ): Promise<Result<LibraryItem, MediaNotUploaded | InvalidInputError>> {
    if (source.kind === 'TEXT') {
      return LibraryItem.text({
        id: target.id,
        libraryId: target.libraryId,
        position: target.position,
        text: source.textContent ?? '',
        now: target.now,
      });
    }

    // Ya se comprobó antes de empezar a copiar; acá vuelve a mirarse solo para
    // estrechar los tipos, que son nulables en el elemento.
    if (!source.storageKey || !source.isReady || source.sizeBytes === null) {
      return err(new MediaNotUploaded());
    }

    const storageKey = mediaKeyOf(target.ownerId, target.libraryId, target.id);

    await this.storage.copy(source.storageKey, storageKey);

    const item = LibraryItem.media({
      id: target.id,
      libraryId: target.libraryId,
      kind: source.kind,
      position: target.position,
      fileName: source.fileName ?? '',
      mimeType: source.mimeType ?? '',
      sizeBytes: source.sizeBytes,
      storageKey,
      now: target.now,
    });

    // El objeto se copió antes de construir el elemento; si el elemento no sale,
    // hay que deshacer la copia o quedaría un archivo suelto.
    if (!item.ok) {
      await this.storage.remove(storageKey);

      return item;
    }

    // Los bytes ya se verificaron cuando entraron al baúl: la copia nace lista,
    // sin pasar otra vez por la confirmación.
    item.value.markReady(source.sizeBytes, target.now);

    return ok(item.value);
  }
}
