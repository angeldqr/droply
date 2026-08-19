/**
 * Los vocabularios que este contexto necesita nombrar.
 *
 * Son copias: el núcleo no puede importar `@droply/contracts` ni el dominio de
 * otro contexto, así que las columnas y el resultado de un envío están escritos
 * otra vez acá. El test guardián de al lado los ata al contrato y falla si
 * alguno se separa.
 */
export const ITEM_KINDS = ['AUDIO', 'VIDEO', 'IMAGE', 'TEXT'] as const;

export type ItemKind = (typeof ITEM_KINDS)[number];

/** Cómo terminó un intento. Es también el enum de la base. */
export const DELIVERY_STATUSES = ['SENT', 'FAILED', 'SKIPPED'] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export function isItemKind(value: string): value is ItemKind {
  return (ITEM_KINDS as readonly string[]).includes(value);
}

export function isDeliveryStatus(value: string): value is DeliveryStatus {
  return (DELIVERY_STATUSES as readonly string[]).includes(value);
}
