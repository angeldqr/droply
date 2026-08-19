/**
 * Las cuatro columnas, otra vez.
 *
 * Es la tercera copia —`libraries` tiene la suya y el contrato la original— y
 * no se comparte porque un contexto no importa del dominio de otro, ni el
 * núcleo del paquete de contratos. El test guardián de al lado las ata.
 */
export const ITEM_KINDS = ['AUDIO', 'VIDEO', 'IMAGE', 'TEXT'] as const;

export type ItemKind = (typeof ITEM_KINDS)[number];

export function isItemKind(value: string): value is ItemKind {
  return (ITEM_KINDS as readonly string[]).includes(value);
}
