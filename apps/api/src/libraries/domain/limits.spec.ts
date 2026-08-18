import {
  LIBRARY_DESCRIPTION_MAX_LENGTH,
  LIBRARY_NAME_MAX_LENGTH,
  TEXT_ITEM_MAX_LENGTH,
} from '@droply/contracts';
import { describe, expect, it } from 'vitest';
import { DESCRIPTION_MAX_LENGTH, NAME_MAX_LENGTH } from './library';
import { TEXT_MAX_LENGTH } from './library-item';

/**
 * El núcleo no puede importar `@droply/contracts`, así que cada límite está
 * escrito dos veces: una para validar en el borde y avisar al usuario mientras
 * escribe, otra para hacerlo cumplir en el dominio. Si se separan, el front
 * dejaría escribir algo que el servidor después rechaza sin explicación.
 */
describe('límites del dominio y del contrato', () => {
  it('coinciden en el largo del nombre de una biblioteca', () => {
    expect(NAME_MAX_LENGTH).toBe(LIBRARY_NAME_MAX_LENGTH);
  });

  it('coinciden en el largo de la descripción', () => {
    expect(DESCRIPTION_MAX_LENGTH).toBe(LIBRARY_DESCRIPTION_MAX_LENGTH);
  });

  it('coinciden en el largo de un texto', () => {
    expect(TEXT_MAX_LENGTH).toBe(TEXT_ITEM_MAX_LENGTH);
  });
});
