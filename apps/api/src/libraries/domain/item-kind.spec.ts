import { itemKind } from '@reconectate/contracts';
import { describe, expect, it } from 'vitest';
import { ITEM_KINDS } from './item-kind';

describe('vocabulario de tipos de elemento', () => {
  it('coincide con el que publica el contrato al front', () => {
    // El núcleo no puede importar `@reconectate/contracts`, así que la lista está
    // escrita dos veces. Este caso es lo que impide que se separen: si alguien
    // agrega una columna en un lado y se olvida del otro, falla acá.
    expect([...ITEM_KINDS]).toEqual([...itemKind.values]);
  });
});
