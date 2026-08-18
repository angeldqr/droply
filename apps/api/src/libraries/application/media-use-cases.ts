import type { Clock } from '../../shared/clock';
import type { InvalidInputError } from '../../shared/domain-error';
import {
  LibraryItemId,
  type IdGenerator,
  type LibraryId,
  type UserId,
} from '../../shared/identifiers';
import { err, ok, type Result } from '../../shared/result';
import {
  ItemNotFound,
  LibraryNotFound,
  MediaNotUploaded,
  MediaTooLarge,
  MediaTypeMismatch,
} from '../domain/errors';
import type { Library } from '../domain/library';
import { LibraryItem } from '../domain/library-item';
import { MEDIA_LIMITS, type MediaKind } from '../domain/media-limits';
import { detectMimeType } from '../domain/media-signature';
import type { LibraryItemRepository, LibraryRepository, MediaStorage } from '../domain/ports';
import type { UploadTicket } from '../domain/ports';
import { positionAtEnd } from '../domain/position';

/**
 * Cómo se acomodan los objetos en el bucket. Está acá y no repetido en cada
 * caso de uso para que borrar una biblioteca entera no se quede sin borrar
 * archivos por una barra de más o de menos.
 */
export function mediaPrefixOf(ownerId: UserId, libraryId: LibraryId): string {
  return `${ownerId}/${libraryId}/`;
}

export function mediaKeyOf(ownerId: UserId, libraryId: LibraryId, itemId: LibraryItemId): string {
  return `${mediaPrefixOf(ownerId, libraryId)}${itemId}`;
}

export interface MediaUploadRequest {
  readonly kind: MediaKind;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

export interface StartedUpload {
  readonly item: LibraryItem;
  readonly ticket: UploadTicket;
}

export class RequestMediaUpload {
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
    request: MediaUploadRequest,
  ): Promise<Result<StartedUpload, LibraryNotFound | InvalidInputError>> {
    const library = await this.libraries.findOwned(libraryId, ownerId);
    if (!library) return err(new LibraryNotFound());

    const now = this.clock.now();
    const id = LibraryItemId.from(this.ids.generate());

    // Al final de su columna, igual que un texto: es donde el botón de agregar
    // espera al usuario en la pantalla.
    const item = LibraryItem.media({
      id,
      libraryId,
      kind: request.kind,
      position: positionAtEnd(await this.items.lastPositionOf(libraryId, request.kind)),
      fileName: request.fileName,
      mimeType: request.mimeType,
      sizeBytes: request.sizeBytes,
      storageKey: mediaKeyOf(ownerId, libraryId, id),
      now,
    });

    if (!item.ok) return item;

    /*
     * El permiso se firma antes de guardar la fila. Si el almacenamiento no
     * responde, no queda un elemento en la biblioteca que nadie va a poder
     * subir nunca y que el usuario tendría que borrar a mano.
     *
     * El techo va en la propia política del permiso: el almacenamiento corta la
     * subida antes de escribir. Comprobarlo después no serviría de nada, porque
     * el disco ya estaría lleno.
     */
    const ticket = await this.storage.ticketFor(
      mediaKeyOf(ownerId, libraryId, id),
      request.mimeType,
      MEDIA_LIMITS[request.kind].maxBytes,
    );

    await this.items.add(item.value);

    library.touch(now);
    await this.libraries.save(library);

    return ok({ item: item.value, ticket });
  }
}

export class ConfirmMediaUpload {
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
  ): Promise<
    Result<
      LibraryItem,
      LibraryNotFound | ItemNotFound | MediaNotUploaded | MediaTooLarge | MediaTypeMismatch
    >
  > {
    const library = await this.libraries.findOwned(libraryId, ownerId);
    if (!library) return err(new LibraryNotFound());

    const item = await this.items.findInLibrary(itemId, libraryId);
    const kind = item?.mediaKind();

    // Un elemento de texto no tiene nada que confirmar, y responde igual que
    // uno que no existe: no hay razón para contar la diferencia.
    if (!item || !item.storageKey || !kind) return err(new ItemNotFound());

    // Confirmar dos veces no puede romper nada: el navegador lo reintenta si se
    // le cortó la respuesta y el archivo ya estaba arriba.
    if (item.isReady) return ok(item);

    // ponytail: una subida que nunca llegó deja el elemento pendiente a la
    // vista, y el usuario lo quita desde el menú de la tarjeta. Un barrido
    // periódico de pendientes viejos entra con el endurecimiento de la fase 7.
    const found = await this.storage.inspect(item.storageKey);
    if (!found) return err(new MediaNotUploaded());

    if (found.sizeBytes > MEDIA_LIMITS[kind].maxBytes) {
      return this.discard(library, item.storageKey, itemId, libraryId, new MediaTooLarge());
    }

    if (detectMimeType(found.head) !== item.mimeType) {
      return this.discard(library, item.storageKey, itemId, libraryId, new MediaTypeMismatch());
    }

    // ponytail: se verifica el tipo y el tamaño, y nada más. Duración,
    // dimensiones y miniatura piden bajar el archivo entero y llamar a ffprobe,
    // o sea un worker con cola; entra cuando el envío por Telegram quiera la
    // duración o el tablero se sienta lento con los originales.
    const now = this.clock.now();

    item.markReady(found.sizeBytes, now);
    await this.items.save(item);

    library.touch(now);
    await this.libraries.save(library);

    return ok(item);
  }

  /**
   * El archivo no es lo que dijo ser: fuera del almacenamiento y fuera de la
   * biblioteca. Dejarlo pendiente sería guardar basura que nadie va a mirar y
   * que nadie sabría por qué está ahí.
   *
   * El objeto se borra antes que la fila. Al revés, si el borrado del objeto
   * fallara, quedaría un archivo suelto sin nada que lo apunte.
   */
  private async discard<E>(
    library: Library,
    storageKey: string,
    itemId: LibraryItemId,
    libraryId: LibraryId,
    error: E,
  ): Promise<Result<never, E>> {
    await this.storage.remove(storageKey);
    await this.items.remove(itemId, libraryId);

    // Quitar un elemento es tocar la biblioteca, igual que agregarlo o moverlo.
    library.touch(this.clock.now());
    await this.libraries.save(library);

    return err(error);
  }
}
