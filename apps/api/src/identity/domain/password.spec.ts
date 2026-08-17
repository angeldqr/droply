import { describe, expect, it } from 'vitest';
import { PlainPassword } from './password';

describe('PlainPassword', () => {
  it('acepta una frase larga sin símbolos raros', () => {
    expect(PlainPassword.create('el perro corre por el parque').ok).toBe(true);
  });

  it('rechaza algo más corto que el mínimo', () => {
    const result = PlainPassword.create('Abc1!');

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe('password.too_short');
  });

  it('rechaza una entrada enorme, que serviría para ocupar la CPU', () => {
    const result = PlainPassword.create('a'.repeat(5000));

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe('password.too_long');
  });

  it('rechaza una que sea solo espacios', () => {
    const result = PlainPassword.create('              ');

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe('password.blank');
  });

  it('no se filtra al convertirla a texto ni al serializarla', () => {
    const result = PlainPassword.create('una frase larga y tranquila');
    if (!result.ok) throw new Error('debería ser válida');

    expect(String(result.value)).not.toContain('frase');
    expect(JSON.stringify({ clave: result.value })).not.toContain('frase');
    expect(result.value.reveal()).toBe('una frase larga y tranquila');
  });
});
