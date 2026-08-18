import { InvalidInputError } from '../../shared/domain-error';
import type { LibraryId, UserId } from '../../shared/identifiers';
import { err, ok, type Result } from '../../shared/result';

export const NAME_MAX_LENGTH = 60;
export const DESCRIPTION_MAX_LENGTH = 240;

export interface LibrarySnapshot {
  readonly id: LibraryId;
  readonly ownerId: UserId;
  readonly name: string;
  readonly description: string | null;
  readonly isVault: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class Library {
  private constructor(
    readonly id: LibraryId,
    readonly ownerId: UserId,
    private currentName: string,
    private currentDescription: string | null,
    readonly isVault: boolean,
    readonly createdAt: Date,
    private currentUpdatedAt: Date,
  ) {}

  static create(input: {
    id: LibraryId;
    ownerId: UserId;
    name: string;
    description?: string | undefined;
    now: Date;
  }): Result<Library, InvalidInputError> {
    const fields = normalize(input.name, input.description);
    if (!fields.ok) return fields;

    return ok(
      new Library(
        input.id,
        input.ownerId,
        fields.value.name,
        fields.value.description,
        false,
        input.now,
        input.now,
      ),
    );
  }

  /**
   * El baúl de una cuenta. No pasa por `normalize` porque su nombre es fijo y
   * no lo escribe nadie: no hay nada que validar ni un error que devolver.
   */
  static vault(input: { id: LibraryId; ownerId: UserId; now: Date }): Library {
    return new Library(input.id, input.ownerId, 'Baúl', null, true, input.now, input.now);
  }

  static fromSnapshot(snapshot: LibrarySnapshot): Library {
    return new Library(
      snapshot.id,
      snapshot.ownerId,
      snapshot.name,
      snapshot.description,
      snapshot.isVault,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get name(): string {
    return this.currentName;
  }

  get description(): string | null {
    return this.currentDescription;
  }

  get updatedAt(): Date {
    return this.currentUpdatedAt;
  }

  rename(
    name: string,
    description: string | undefined,
    now: Date,
  ): Result<void, InvalidInputError> {
    const fields = normalize(name, description);
    if (!fields.ok) return fields;

    this.currentName = fields.value.name;
    this.currentDescription = fields.value.description;
    this.currentUpdatedAt = now;

    return ok();
  }

  /** Agregar o mover un elemento cuenta como tocar la biblioteca. */
  touch(now: Date): void {
    this.currentUpdatedAt = now;
  }

  toSnapshot(): LibrarySnapshot {
    return {
      id: this.id,
      ownerId: this.ownerId,
      name: this.currentName,
      description: this.currentDescription,
      isVault: this.isVault,
      createdAt: this.createdAt,
      updatedAt: this.currentUpdatedAt,
    };
  }
}

function normalize(
  rawName: string,
  rawDescription: string | undefined,
): Result<{ name: string; description: string | null }, InvalidInputError> {
  const name = rawName.trim();

  if (name.length === 0) {
    return err(new InvalidInputError('library.name_required', 'Escribe un nombre.'));
  }

  if (name.length > NAME_MAX_LENGTH) {
    return err(
      new InvalidInputError(
        'library.name_too_long',
        `El nombre no puede pasar de ${NAME_MAX_LENGTH} caracteres.`,
      ),
    );
  }

  const description = rawDescription?.trim() ?? '';

  if (description.length > DESCRIPTION_MAX_LENGTH) {
    return err(
      new InvalidInputError(
        'library.description_too_long',
        `La descripción no puede pasar de ${DESCRIPTION_MAX_LENGTH} caracteres.`,
      ),
    );
  }

  return ok({ name, description: description.length > 0 ? description : null });
}
