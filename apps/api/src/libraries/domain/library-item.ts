import { InvalidInputError } from '../../shared/domain-error';
import type { LibraryId, LibraryItemId } from '../../shared/identifiers';
import { err, ok, type Result } from '../../shared/result';
import { MediaTooLarge } from './errors';
import type { ItemKind } from './item-kind';
import { isMediaKind, MEDIA_LIMITS, type MediaKind } from './media-limits';

export const TEXT_MAX_LENGTH = 4096;
export const FILE_NAME_MAX_LENGTH = 200;
export const TIMES_PER_DAY_MAX = 12;

export interface LibraryItemSnapshot {
  readonly id: LibraryItemId;
  readonly libraryId: LibraryId;
  readonly kind: ItemKind;
  readonly position: number;
  readonly timesPerDay: number;
  readonly textContent: string | null;
  readonly storageKey: string | null;
  readonly fileName: string | null;
  readonly mimeType: string | null;
  readonly sizeBytes: number | null;
  readonly mediaReadyAt: Date | null;
  readonly createdAt: Date;
}

/**
 * El estado va en un solo campo y no en once parámetros posicionales: cinco de
 * ellos son `null` en todo elemento de texto, y en una fila de cinco `null`
 * seguidos ningún tipo avisa si dos se cruzan de lugar.
 */
export class LibraryItem {
  private constructor(private state: LibraryItemSnapshot) {}

  static text(input: {
    id: LibraryItemId;
    libraryId: LibraryId;
    position: number;
    text: string;
    now: Date;
  }): Result<LibraryItem, InvalidInputError> {
    const content = input.text.trim();

    if (content.length === 0) {
      return err(new InvalidInputError('item.text_empty', 'El texto no puede estar vacío.'));
    }

    if (content.length > TEXT_MAX_LENGTH) {
      return err(
        new InvalidInputError(
          'item.text_too_long',
          `El texto no puede pasar de ${TEXT_MAX_LENGTH} caracteres.`,
        ),
      );
    }

    return ok(
      new LibraryItem({
        id: input.id,
        libraryId: input.libraryId,
        kind: 'TEXT',
        position: input.position,
        timesPerDay: 1,
        textContent: content,
        storageKey: null,
        fileName: null,
        mimeType: null,
        sizeBytes: null,
        mediaReadyAt: null,
        createdAt: input.now,
      }),
    );
  }

  /**
   * Nace pendiente: el permiso de subida está por firmarse y el archivo todavía
   * no existe. Lo que se valida acá es lo que el navegador *dice* que va a
   * subir; que sea verdad se comprueba después, contra el archivo de verdad.
   */
  static media(input: {
    id: LibraryItemId;
    libraryId: LibraryId;
    kind: ItemKind;
    position: number;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
    now: Date;
  }): Result<LibraryItem, InvalidInputError> {
    if (!isMediaKind(input.kind)) {
      return err(new InvalidInputError('item.kind_not_media', 'Esa columna no lleva archivos.'));
    }

    const fileName = input.fileName.trim();

    if (fileName.length === 0 || fileName.length > FILE_NAME_MAX_LENGTH) {
      return err(
        new InvalidInputError('item.media_name_invalid', 'Ese nombre de archivo no sirve.'),
      );
    }

    const limits = MEDIA_LIMITS[input.kind];

    if (!limits.mimeTypes.includes(input.mimeType)) {
      return err(
        new InvalidInputError(
          'item.media_type_unsupported',
          'Ese tipo de archivo no sirve para esta columna.',
        ),
      );
    }

    if (input.sizeBytes <= 0 || input.sizeBytes > limits.maxBytes) {
      return err(new MediaTooLarge());
    }

    return ok(
      new LibraryItem({
        id: input.id,
        libraryId: input.libraryId,
        kind: input.kind,
        position: input.position,
        timesPerDay: 1,
        textContent: null,
        storageKey: input.storageKey,
        fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        mediaReadyAt: null,
        createdAt: input.now,
      }),
    );
  }

  static fromSnapshot(snapshot: LibraryItemSnapshot): LibraryItem {
    return new LibraryItem(snapshot);
  }

  get id(): LibraryItemId {
    return this.state.id;
  }

  get libraryId(): LibraryId {
    return this.state.libraryId;
  }

  get kind(): ItemKind {
    return this.state.kind;
  }

  get position(): number {
    return this.state.position;
  }

  get timesPerDay(): number {
    return this.state.timesPerDay;
  }

  get textContent(): string | null {
    return this.state.textContent;
  }

  get storageKey(): string | null {
    return this.state.storageKey;
  }

  get fileName(): string | null {
    return this.state.fileName;
  }

  /**
   * El tipo del archivo. Mientras el elemento está pendiente es el que declaró
   * el navegador; confirmar exige que el detectado en los bytes sea idéntico,
   * así que en un elemento listo es un tipo verificado.
   */
  get mimeType(): string | null {
    return this.state.mimeType;
  }

  get sizeBytes(): number | null {
    return this.state.sizeBytes;
  }

  get createdAt(): Date {
    return this.state.createdAt;
  }

  /** Verificado y listo para mostrarse. Hasta entonces no hay URL que dar. */
  get isReady(): boolean {
    return this.state.mediaReadyAt !== null;
  }

  /** El tipo de columna, ya sabiendo que este elemento lleva archivo. */
  mediaKind(): MediaKind | null {
    return this.state.storageKey !== null && isMediaKind(this.state.kind) ? this.state.kind : null;
  }

  moveTo(position: number): void {
    this.state = { ...this.state, position };
  }

  /**
   * Cuántas veces al día quiere enviarse este elemento.
   *
   * El horario decide entre qué horas; esto decide cuántas veces dentro de esa
   * franja. Uno es lo normal y el techo evita que alguien pida cien sin darse
   * cuenta de lo que está pidiendo.
   */
  sendTimesPerDay(times: number): Result<void, InvalidInputError> {
    if (!Number.isInteger(times) || times < 1 || times > TIMES_PER_DAY_MAX) {
      return err(
        new InvalidInputError(
          'item.times_per_day_invalid',
          `Tiene que ser un número entre 1 y ${TIMES_PER_DAY_MAX}.`,
        ),
      );
    }

    this.state = { ...this.state, timesPerDay: times };

    return ok();
  }

  /**
   * El tamaño se rescribe con el del archivo que llegó de verdad: el declarado
   * era una promesa del navegador. El tipo no hace falta tocarlo, porque
   * confirmar ya exigió que coincidieran.
   */
  markReady(sizeBytes: number, now: Date): void {
    this.state = { ...this.state, sizeBytes, mediaReadyAt: now };
  }

  toSnapshot(): LibraryItemSnapshot {
    return this.state;
  }
}
