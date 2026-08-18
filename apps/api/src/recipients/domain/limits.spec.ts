import { channel, RECIPIENT_LABEL_MAX_LENGTH } from '@droply/contracts';
import { describe, expect, it } from 'vitest';
import { LABEL_MAX_LENGTH, type RecipientChannel } from './recipient';

/**
 * El núcleo no puede importar `@droply/contracts`, así que lo que el contrato
 * valida en el borde está escrito otra vez acá adentro. Si se separan, el front
 * dejaría escribir algo que el servidor después rechaza sin explicación, o
 * peor: guardaríamos un canal que el contrato ni siquiera sabe nombrar.
 */
describe('límites y vocabulario del dominio frente al contrato', () => {
  it('coinciden en el largo de la etiqueta', () => {
    expect(LABEL_MAX_LENGTH).toBe(RECIPIENT_LABEL_MAX_LENGTH);
  });

  it('el canal del dominio existe en el vocabulario del contrato', () => {
    const supported: RecipientChannel[] = ['TELEGRAM'];

    for (const value of supported) {
      expect(channel.values).toContain(value);
    }
  });
});
