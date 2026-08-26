import type { ItemKind } from './item-kind';

/** Todo lo que no es texto llega como archivo. */
export type MediaKind = Exclude<ItemKind, 'TEXT'>;

export interface MediaLimit {
  readonly maxBytes: number;
  readonly mimeTypes: readonly string[];
}

/**
 * Los techos del Bot API de Telegram, escritos otra vez porque el núcleo no
 * puede importar `@reconectate/contracts`. `media-limits.spec.ts` es lo único que
 * impide que las dos copias se separen.
 */
export const MEDIA_LIMITS: Readonly<Record<MediaKind, MediaLimit>> = {
  IMAGE: {
    maxBytes: 10 * 1024 * 1024,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  },
  VIDEO: {
    maxBytes: 50 * 1024 * 1024,
    mimeTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
  },
  AUDIO: {
    maxBytes: 50 * 1024 * 1024,
    mimeTypes: ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/aac'],
  },
};

export function isMediaKind(kind: ItemKind): kind is MediaKind {
  return kind !== 'TEXT';
}
