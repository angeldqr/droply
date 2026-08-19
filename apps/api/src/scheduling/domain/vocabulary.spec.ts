import { itemKind, selectionStrategy } from '@droply/contracts';
import { describe, expect, it } from 'vitest';
import { ITEM_KINDS } from './item-kind';
import { SELECTION_STRATEGIES } from './selection-strategy';

/**
 * El núcleo no puede importar `@droply/contracts`, así que estos dos
 * vocabularios están escritos dos veces. Si se separan, el front ofrecería una
 * estrategia que el servidor no sabe aplicar, o al revés.
 */
describe('vocabulario del dominio frente al contrato', () => {
  it('coinciden las columnas', () => {
    expect([...ITEM_KINDS]).toEqual([...itemKind.values]);
  });

  it('coinciden las estrategias de selección', () => {
    expect([...SELECTION_STRATEGIES]).toEqual([...selectionStrategy.values]);
  });
});
