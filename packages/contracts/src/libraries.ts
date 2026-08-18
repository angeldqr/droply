import { z } from 'zod';
import { itemKind, MEDIA_LIMITS, TEXT_ITEM_MAX_LENGTH, type ItemKind } from './primitives.js';

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

/** Todo lo que no es texto llega como archivo. */
export const uploadableKind = z.enum(['AUDIO', 'VIDEO', 'IMAGE']);

/** "10 MB", no "10485760 bytes". */
export function megabytes(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

/**
 * Lo que el navegador declara antes de subir. Se comprueba acá para avisarle en
 * el acto, y el propio almacenamiento vuelve a aplicar el techo de tamaño sobre
 * el archivo de verdad: esto es cortesía, no la defensa.
 */
export const MEDIA_FILE_NAME_MAX_LENGTH = 200;

export const requestUploadSchema = z
  .object({
    kind: uploadableKind,
    fileName: z.string().trim().min(1).max(MEDIA_FILE_NAME_MAX_LENGTH),
    mimeType: z.string(),
    sizeBytes: z.number().int().positive(),
  })
  .superRefine((value, ctx) => {
    const limits = MEDIA_LIMITS[value.kind];

    if (!(limits.mimeTypes as readonly string[]).includes(value.mimeType)) {
      ctx.addIssue({
        code: 'custom',
        path: ['mimeType'],
        message: 'Ese tipo de archivo no sirve para esta columna.',
      });
    }

    if (value.sizeBytes > limits.maxBytes) {
      ctx.addIssue({
        code: 'custom',
        path: ['sizeBytes'],
        message: `El archivo no puede pasar de ${megabytes(limits.maxBytes)}.`,
      });
    }
  });

/**
 * Llevar algo del baúl a una biblioteca. Solo hace falta decir qué elemento del
 * baúl: la columna y el nombre salen del original.
 */
export const copyFromVaultSchema = z.object({
  sourceItemId: z.uuid(),
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
export type UploadableKind = z.infer<typeof uploadableKind>;
export type CopyFromVaultInput = z.infer<typeof copyFromVaultSchema>;
export type RequestUploadInput = z.infer<typeof requestUploadSchema>;

/**
 * El archivo de un elemento que no es texto. `url` viene firmada y de vida
 * corta, y es `null` mientras la subida no se ha confirmado: no hace falta un
 * estado aparte, porque no hay URL que dar hasta que el archivo se verificó.
 */
export interface MediaView {
  /** El nombre que traía el archivo. Es lo único que identifica la tarjeta. */
  readonly fileName: string;
  readonly url: string | null;
}

export interface LibraryItemView {
  readonly id: string;
  readonly kind: ItemKind;
  readonly position: number;
  readonly text: string | null;
  readonly media: MediaView | null;
  readonly createdAt: string;
}

/** El permiso de subida: se manda tal cual a la URL, con el archivo al final. */
export interface UploadTicketView {
  readonly url: string;
  readonly fields: Readonly<Record<string, string>>;
}

export interface StartUploadResult {
  readonly item: LibraryItemView;
  readonly upload: UploadTicketView;
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
