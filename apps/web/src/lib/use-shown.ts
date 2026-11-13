'use client';

import { firstParts } from '@reconectate/contracts';
import { useCallback, useState } from 'react';

/**
 * Muestra una lista por partes: primero `size`, y `size` más con cada «Ver más».
 *
 * La lista ya está entera en la pantalla; esto solo decide cuánto se dibuja.
 * Quien calcule un resumen (un contador, un calendario) usa la lista completa,
 * no `shown`.
 *
 * ponytail: la descarga sigue siendo completa. Si una cuenta llega a miles de
 * elementos, toca paginar en el servidor.
 */
export function useShown<T>(items: readonly T[], size: number) {
  const [parts, setParts] = useState(1);
  const { shown, remaining } = firstParts(items, parts, size);

  return {
    shown,
    remaining,
    more: useCallback(() => setParts((current) => current + 1), []),
    /** Todo de una vez: para cuando hay que llegar a un elemento que aún no se dibujó. */
    all: useCallback(() => setParts(Number.POSITIVE_INFINITY), []),
  };
}
