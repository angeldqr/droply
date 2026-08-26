import {
  itemKind,
  SENDER_NAME_MAX_LENGTH as SENDER_NAME_MAX_LENGTH_CONTRACT,
} from '@reconectate/contracts';
import { describe, expect, it } from 'vitest';
import { ITEM_KINDS } from './item-kind';
import { SENDER_NAME_MAX_LENGTH } from './schedule';

/**
 * El núcleo no puede importar `@reconectate/contracts`, así que estos dos
 * vocabularios están escritos dos veces. Si se separan, el front ofrecería una
 * columna que el servidor no sabe filtrar, o al revés.
 */
describe('vocabulario del dominio frente al contrato', () => {
  it('coinciden las columnas', () => {
    expect([...ITEM_KINDS]).toEqual([...itemKind.values]);
  });

  it('coinciden en el largo del nombre de quien envía', () => {
    expect(SENDER_NAME_MAX_LENGTH).toBe(SENDER_NAME_MAX_LENGTH_CONTRACT);
  });
});
