import { inspect } from 'node:util';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@droply/contracts';
import { describe, expect, it } from 'vitest';
import { PlainPassword } from './password';

describe('PlainPassword', () => {
  it('mantiene los mismos límites que publica el contrato al front', () => {
    // El núcleo no puede importar `@droply/contracts`, así que los números
    // están escritos dos veces. Este caso es lo que impide que se separen.
    expect(PlainPassword.minimumLength).toBe(PASSWORD_MIN_LENGTH);
    expect(PlainPassword.maximumLength).toBe(PASSWORD_MAX_LENGTH);
  });

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

  it('no se filtra por ninguno de los caminos por los que se suele loguear', () => {
    const clave = 'una frase larga y tranquila';
    const result = PlainPassword.create(clave);
    if (!result.ok) throw new Error('debería ser válida');

    // `inspect` es el que importa de verdad: es lo que usan `console.log` y el
    // logger de Nest, y un `private` de TypeScript no lo detiene.
    expect(inspect(result.value)).not.toContain('frase');
    expect(inspect({ envoltorio: result.value }, { depth: 5 })).not.toContain('frase');
    expect(String(result.value)).not.toContain('frase');
    // La regla prohíbe interpolar un objeto justo para evitar filtraciones así.
    // Acá se hace a propósito: es el descuido que el enmascarado debe cubrir.
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    expect(`${result.value}`).not.toContain('frase');
    expect(JSON.stringify({ clave: result.value })).not.toContain('frase');
    expect(Object.values(result.value).join(' ')).not.toContain('frase');

    expect(result.value.reveal()).toBe(clave);
  });
});
