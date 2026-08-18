import { InvalidInputError } from '../../shared/domain-error';
import type { LibraryId, LibraryItemId } from '../../shared/identifiers';
import { err, ok, type Result } from '../../shared/result';
import type { ItemKind } from './item-kind';

export const TEXT_MAX_LENGTH = 4096;

export interface LibraryItemSnapshot {
  readonly id: LibraryItemId;
  readonly libraryId: LibraryId;
  readonly kind: ItemKind;
  readonly position: number;
  readonly textContent: string | null;
  readonly createdAt: Date;
}

export class LibraryItem {
  private constructor(
    readonly id: LibraryItemId,
    readonly libraryId: LibraryId,
    readonly kind: ItemKind,
    private currentPosition: number,
    readonly textContent: string | null,
    readonly createdAt: Date,
  ) {}

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
      new LibraryItem(input.id, input.libraryId, 'TEXT', input.position, content, input.now),
    );
  }

  static fromSnapshot(snapshot: LibraryItemSnapshot): LibraryItem {
    return new LibraryItem(
      snapshot.id,
      snapshot.libraryId,
      snapshot.kind,
      snapshot.position,
      snapshot.textContent,
      snapshot.createdAt,
    );
  }

  get position(): number {
    return this.currentPosition;
  }

  moveTo(position: number): void {
    this.currentPosition = position;
  }

  toSnapshot(): LibraryItemSnapshot {
    return {
      id: this.id,
      libraryId: this.libraryId,
      kind: this.kind,
      position: this.currentPosition,
      textContent: this.textContent,
      createdAt: this.createdAt,
    };
  }
}
