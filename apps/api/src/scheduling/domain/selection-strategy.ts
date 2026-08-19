/**
 * Cómo se elige qué elemento sale en cada envío.
 *
 * Copia del vocabulario del contrato, porque el núcleo no puede importarlo. Un
 * test guardián los compara y falla si se separan.
 */
export const SELECTION_STRATEGIES = ['RANDOM', 'RANDOM_NO_REPEAT', 'SEQUENTIAL'] as const;

export type SelectionStrategy = (typeof SELECTION_STRATEGIES)[number];

export function isSelectionStrategy(value: string): value is SelectionStrategy {
  return (SELECTION_STRATEGIES as readonly string[]).includes(value);
}
