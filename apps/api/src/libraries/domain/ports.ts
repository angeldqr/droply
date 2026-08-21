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
  /** El baúl de la cuenta, si ya se creó. No sale en `listOwnedBy`. */
  findVaultOf(ownerId: UserId): Promise<Library | null>;
  add(library: Library): Promise<void>;
  save(library: Library): Promise<void>;
  remove(id: LibraryId, ownerId: UserId): Promise<void>;
}

/**
 * Quiénes pueden recibir lo de una biblioteca.
 *
 * Vive acá y no en `recipients` porque la pertenencia es de la biblioteca: es
 * ella la que decide a quién se le manda lo suyo, no el destinatario el que se
 * apunta a bibliotecas.
 */
export interface LibraryRecipientRepository {
  idsOf(libraryId: LibraryId): Promise<string[]>;
  /** Reemplaza la lista entera: es lo que hace el diálogo de casillas. */
  replace(libraryId: LibraryId, recipientIds: readonly string[]): Promise<void>;
}

/**
 * Los destinatarios de la cuenta que ya apretaron Empezar.
 *
 * Es lo único que `libraries` necesita saber del contexto de destinatarios, y
 * llega como puerto porque un contexto no importa del dominio de otro. Solo los
 * vinculados: apuntar una biblioteca a alguien que nunca habló con el bot sería
 * guardar una intención que no puede cumplirse.
 */
export interface LinkedRecipients {
  idsOf(ownerId: UserId): Promise<string[]>;
}

/**
 * Borra los horarios que quedaron apuntando a alguien que ya no está en la
 * lista de la biblioteca.
 *
 * Sin esto, desmarcar a una persona no la deja de alcanzar: la casilla se
 * apaga en la pantalla pero el horario que ya existía sigue enviándole cada
 * mañana. Quitar a alguien tiene que cortar el envío de verdad, y ese es el
 * único sitio donde se sabe qué pares dejaron de valer.
 */
export interface SchedulePruner {
  dropOutside(libraryId: LibraryId, recipientIds: readonly string[]): Promise<number>;
}

export interface LibraryItemRepository {
  listOf(libraryId: LibraryId): Promise<LibraryItem[]>;
  findInLibrary(id: LibraryItemId, libraryId: LibraryId): Promise<LibraryItem | null>;
  lastPositionOf(libraryId: LibraryId, kind: ItemKind): Promise<number | null>;
  add(item: LibraryItem): Promise<void>;
  save(item: LibraryItem): Promise<void>;
  savePositions(items: readonly LibraryItem[]): Promise<void>;
  remove(id: LibraryItemId, libraryId: LibraryId): Promise<void>;
  /**
   * Las subidas que nunca llegaron: permiso firmado, fila creada y archivo que
   * no apareció nunca en el bucket.
   *
   * Es la única lectura sin dueño de todo el contexto, y a propósito: no la
   * pide nadie desde una pantalla, la hace la aplicación sola para no ir
   * juntando filas y objetos que no apuntan a nada.
   */
  staleUploads(
    before: Date,
    limit: number,
  ): Promise<{ id: LibraryItemId; libraryId: LibraryId; storageKey: string }[]>;
}

/**
 * El permiso para subir un archivo, tal como lo espera el almacenamiento: los
 * campos se mandan primero y el archivo al final.
 */
export interface UploadTicket {
  readonly url: string;
  readonly fields: Readonly<Record<string, string>>;
}

/**
 * El archivo nunca pasa por acá: se firma un permiso, el navegador sube directo
 * y después se leen los primeros bytes para comprobar qué llegó.
 */
export interface MediaStorage {
  ticketFor(key: string, mimeType: string, maxBytes: number): Promise<UploadTicket>;
  /** `null` si el objeto no existe, o sea que el navegador nunca subió nada. */
  inspect(key: string): Promise<{ sizeBytes: number; head: Uint8Array } | null>;
  /**
   * Duplica un objeto dentro del mismo bucket, sin bajarlo ni volver a subirlo.
   *
   * ponytail: llevar algo del baúl a una biblioteca copia los bytes en vez de
   * compartirlos. Compartir pediría una tabla de archivos con recuento de
   * referencias para saber cuándo se puede borrar de verdad; hasta que el disco
   * moleste, dos copias cuestan menos que esa contabilidad.
   */
  copy(fromKey: string, toKey: string): Promise<void>;
  /** Una URL de lectura firmada y de vida corta. El bucket es privado. */
  linkTo(key: string): Promise<string>;
  /**
   * Los dos borrados son "lo mejor que se pueda": no fallan aunque el
   * almacenamiento no responda. Quitar un elemento no puede quedar bloqueado
   * por un archivo que no se dejó borrar.
   */
  remove(key: string): Promise<void>;
  removeUnder(prefix: string): Promise<void>;
}

export const LIBRARY_REPOSITORY = Symbol('LibraryRepository');
export const LIBRARY_ITEM_REPOSITORY = Symbol('LibraryItemRepository');
export const LIBRARY_RECIPIENT_REPOSITORY = Symbol('LibraryRecipientRepository');
export const LINKED_RECIPIENTS = Symbol('LinkedRecipients');
export const SCHEDULE_PRUNER = Symbol('SchedulePruner');
export const MEDIA_STORAGE = Symbol('MediaStorage');
