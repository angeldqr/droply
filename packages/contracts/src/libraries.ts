import { z } from 'zod';
import { itemKind, TEXT_ITEM_MAX_LENGTH, type ItemKind } from './primitives.js';

export const LIBRARY_NAME_MAX_LENGTH = 60;
export const LIBRARY_DESCRIPTION_MAX_LENGTH = 240;

export const createLibrarySchema = z.object({
  name: z.string().trim().min(1, 'Escribe un nombre.').max(LIBRARY_NAME_MAX_LENGTH),
  description: z.string().trim().max(LIBRARY_DESCRIPTION_MAX_LENGTH).optional(),
});

export const renameLibrarySchema = createLibrarySchema;

export const addTextItemSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Escribe algo.')
    .max(TEXT_ITEM_MAX_LENGTH, `El texto no puede pasar de ${TEXT_ITEM_MAX_LENGTH} caracteres.`),
});

/**
 * Mover un elemento se expresa por sus vecinos y no por un índice: dos personas
 * arrastrando a la vez sobre la misma columna se pisarían los índices, mientras
 * que "entre estos dos" sigue significando lo mismo.
 */
export const moveItemSchema = z
  .object({
    afterItemId: z.uuid().nullish(),
    beforeItemId: z.uuid().nullish(),
  })
  .refine((value) => value.afterItemId ?? value.beforeItemId, {
    message: 'Indica al menos uno de los dos vecinos.',
  })
  .refine((value) => !value.afterItemId || value.afterItemId !== value.beforeItemId, {
    message: 'Los dos vecinos no pueden ser el mismo elemento.',
  });

export type CreateLibraryInput = z.infer<typeof createLibrarySchema>;
export type RenameLibraryInput = z.infer<typeof renameLibrarySchema>;
export type AddTextItemInput = z.infer<typeof addTextItemSchema>;
export type MoveItemInput = z.infer<typeof moveItemSchema>;

export interface LibraryItemView {
  readonly id: string;
  readonly kind: ItemKind;
  readonly position: number;
  readonly text: string | null;
  readonly createdAt: string;
}

export interface LibrarySummary {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  /** Cuántos elementos hay en cada columna, para la tarjeta del listado. */
  readonly counts: Readonly<Record<ItemKind, number>>;
  readonly updatedAt: string;
}

export interface LibraryDetail extends LibrarySummary {
  readonly items: readonly LibraryItemView[];
}

/** El orden en que se muestran las columnas, igual que en el boceto. */
export const COLUMN_ORDER = itemKind.values;

export const COLUMN_LABELS: Readonly<Record<ItemKind, string>> = {
  AUDIO: 'Audios',
  VIDEO: 'Videos',
  IMAGE: 'Imágenes',
  TEXT: 'Textos',
};

const COLUMN_LABELS_SINGULAR: Readonly<Record<ItemKind, string>> = {
  AUDIO: 'audio',
  VIDEO: 'video',
  IMAGE: 'imagen',
  TEXT: 'texto',
};

/** "1 texto" y no "1 textos". */
export function countLabel(kind: ItemKind, count: number): string {
  return `${count} ${count === 1 ? COLUMN_LABELS_SINGULAR[kind] : COLUMN_LABELS[kind].toLowerCase()}`;
}
