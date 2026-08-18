/**
 * Posiciones fraccionarias.
 *
 * Insertar entre dos vecinos es promediarlos, así que arrastrar un elemento
 * escribe una sola fila en vez de renumerar la columna entera. El costo es que
 * los promedios sucesivos consumen precisión: partiendo del mismo hueco unas
 * cincuenta veces seguidas, dos posiciones dejan de distinguirse en un `double`.
 *
 * Cuando eso pasa, `needsRebalance` avisa y quien llama renumera la columna. En
 * una columna con decenas de elementos es un caso que no se alcanza usando la
 * aplicación a mano.
 */

/** Separación entre elementos recién agregados al final de una columna. */
const STEP = 1024;

/** Por debajo de esto, dos vecinos ya están demasiado cerca para partirlos. */
const MINIMUM_GAP = 1e-6;

export function positionAtEnd(lastPosition: number | null): number {
  return lastPosition === null ? STEP : lastPosition + STEP;
}

export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return STEP;
  if (before === null) return after! / 2;
  if (after === null) return before + STEP;

  return (before + after) / 2;
}

export function needsRebalance(before: number | null, after: number | null): boolean {
  if (before === null || after === null) return false;

  return Math.abs(after - before) < MINIMUM_GAP;
}

/** Reparte posiciones nuevas y bien separadas, respetando el orden actual. */
export function rebalanced(count: number): number[] {
  return Array.from({ length: count }, (_, index) => (index + 1) * STEP);
}
