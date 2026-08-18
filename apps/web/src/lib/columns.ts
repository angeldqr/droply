import type { ItemKind } from '@droply/contracts';

/**
 * El color de cada columna.
 *
 * Los cuatro tonos son los de la paleta y no se repiten: el encabezado del
 * tablero y la etiqueta de la tarjeta usan el mismo, así que el color termina
 * diciendo de qué tipo de contenido se habla antes de leer la palabra. Vive
 * acá y no en cada pantalla para que las dos no se separen.
 */
export const COLUMN_TINT: Readonly<Record<ItemKind, string>> = {
  AUDIO: 'bg-columna-audio',
  VIDEO: 'bg-columna-video',
  IMAGE: 'bg-columna-imagen',
  TEXT: 'bg-columna-texto',
};
