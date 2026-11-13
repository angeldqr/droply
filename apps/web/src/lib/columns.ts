import type { ItemKind } from '@reconectate/contracts';

/**
 * El color de cada columna, con su tinta.
 *
 * Cada columna tiene su matiz. Los cuatro son rellenos claros, así que llevan
 * la misma tinta que la menta, `sobre-menta`.
 *
 * Vive acá y no en cada pantalla para que el tablero y las etiquetas de las
 * tarjetas no se separen.
 */
export const COLUMN_TINT: Readonly<Record<ItemKind, string>> = {
  AUDIO: 'bg-columna-audio text-sobre-menta',
  VIDEO: 'bg-columna-video text-sobre-menta',
  IMAGE: 'bg-columna-imagen text-sobre-menta',
  TEXT: 'bg-columna-texto text-sobre-menta',
};
