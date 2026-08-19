import { z } from 'zod';

/**
 * Declara un vocabulario cerrado una sola vez y deriva de ahí la tupla, el tipo
 * y el esquema. Evita que la lista y su union se desincronicen.
 */
function vocabulary<const T extends readonly [string, ...string[]]>(values: T) {
  return {
    values,
    schema: z.enum(values),
    is: (candidate: unknown): candidate is T[number] =>
      typeof candidate === 'string' && (values as readonly string[]).includes(candidate),
  };
}

export const itemKind = vocabulary(['AUDIO', 'VIDEO', 'IMAGE', 'TEXT'] as const);
export type ItemKind = (typeof itemKind.values)[number];

export const channel = vocabulary(['TELEGRAM', 'WHATSAPP'] as const);
export type Channel = (typeof channel.values)[number];

export const mediaStatus = vocabulary(['PENDING', 'READY', 'FAILED'] as const);
export type MediaStatus = (typeof mediaStatus.values)[number];

export const deliveryStatus = vocabulary(['SENT', 'FAILED', 'SKIPPED'] as const);
export type DeliveryStatus = (typeof deliveryStatus.values)[number];

export const userRole = vocabulary(['USER', 'ADMIN'] as const);
export type UserRole = (typeof userRole.values)[number];

export const recipientStatus = vocabulary(['PENDING', 'VERIFIED', 'BLOCKED'] as const);
export type RecipientStatus = (typeof recipientStatus.values)[number];

/**
 * Techos del Bot API de Telegram. Se validan en la subida para que el usuario
 * se entere en el momento y no cuando falla el envío de las 8 de la mañana.
 */
export const MEDIA_LIMITS = {
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
} as const satisfies Record<
  Exclude<ItemKind, 'TEXT'>,
  { maxBytes: number; mimeTypes: readonly string[] }
>;

export const TEXT_ITEM_MAX_LENGTH = 4096;
