import { deliveryStatus, itemKind } from '@reconectate/contracts';
import { describe, expect, it } from 'vitest';
import { DELIVERY_STATUSES, ITEM_KINDS } from './vocabulary';

/**
 * El núcleo no puede importar `@reconectate/contracts`, así que estos vocabularios
 * están escritos dos veces. Si se separan, el historial mostraría un estado que
 * el servidor nunca escribe, o el envío filtraría por una columna que el front
 * no sabe ofrecer.
 */
describe('vocabulario de envíos frente al contrato', () => {
  it('coinciden las columnas', () => {
    expect([...ITEM_KINDS]).toEqual([...itemKind.values]);
  });

  it('coinciden los estados de un envío', () => {
    expect([...DELIVERY_STATUSES]).toEqual([...deliveryStatus.values]);
  });
});
