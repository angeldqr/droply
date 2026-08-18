/**
 * Las cuatro columnas del tablero. Se repite acá en vez de importarse de
 * `@droply/contracts` porque el núcleo no depende de paquetes externos; un test
 * comprueba que las dos listas coincidan.
 */
export const ITEM_KINDS = ['AUDIO', 'VIDEO', 'IMAGE', 'TEXT'] as const;

export type ItemKind = (typeof ITEM_KINDS)[number];

/** Un contador por columna, arrancando en cero. */
export function emptyCounts(): Record<ItemKind, number> {
  return Object.fromEntries(ITEM_KINDS.map((kind) => [kind, 0])) as Record<ItemKind, number>;
}
