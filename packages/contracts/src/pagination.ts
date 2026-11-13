import { z } from 'zod';

export const PAGE_SIZE_DEFAULT = 20;
export const PAGE_SIZE_MAX = 50;

/**
 * Lo que pide quien quiere una página de una lista.
 *
 * Llega por la dirección, así que los números vienen como texto: `coerce` los
 * convierte antes de validar. Un tamaño sin techo dejaría pedir la tabla entera
 * de una vez, que es justo lo que la paginación viene a evitar.
 */
export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).default(PAGE_SIZE_DEFAULT),
});
export type PageQuery = z.infer<typeof pageQuerySchema>;

/**
 * Una página de una lista, con el total para saber cuántas hay.
 *
 * Una página que no existe no es un error: llega vacía y con el total de
 * siempre, y la pantalla sabe volver a la última.
 */
export interface Paged<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

/** Cuántas páginas hay. Con cero elementos sigue habiendo una: la vacía. */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/**
 * Las primeras `parts` partes de una lista que ya está entera en la pantalla,
 * y cuántos elementos quedan sin mostrar.
 *
 * Es para las listas que se recortan en la web con «Ver más»: la lista llega
 * completa —los resúmenes la necesitan toda— y solo se dibuja un tramo.
 */
export function firstParts<T>(
  items: readonly T[],
  parts: number,
  size: number,
): { readonly shown: readonly T[]; readonly remaining: number } {
  const shown = items.slice(0, parts * size);

  return { shown, remaining: items.length - shown.length };
}
