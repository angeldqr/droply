/** Un tramo de una lista y cuántos elementos tiene la lista entera. */
export interface Page<T> {
  readonly items: T[];
  readonly total: number;
}

/** Cuántos elementos hay que saltarse para llegar a esa página. La primera es la 1. */
export function offsetOf(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}
