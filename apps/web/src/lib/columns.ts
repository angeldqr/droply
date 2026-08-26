import type { ItemKind } from '@reconectate/contracts';

/**
 * El color de cada columna, con su tinta.
 *
 * Los cuatro tonos salen de la misma familia morada y se reparten la escala de
 * claridad, así que **la tinta no puede ser la misma en los cuatro**: sobre el
 * morado oscuro de Videos, el texto de siempre se pierde. Cada columna trae la
 * suya, y por eso esto es un par de clases y no una sola.
 *
 * Vive acá y no en cada pantalla para que el tablero y las etiquetas de las
 * tarjetas no se separen.
 */
export const COLUMN_TINT: Readonly<Record<ItemKind, string>> = {
  AUDIO: 'bg-columna-audio text-foreground',
  VIDEO: 'bg-columna-video text-white',
  IMAGE: 'bg-columna-imagen text-foreground',
  TEXT: 'bg-columna-texto text-foreground',
};
