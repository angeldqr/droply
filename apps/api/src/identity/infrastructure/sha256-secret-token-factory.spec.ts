import { describe, expect, it } from 'vitest';
import { Sha256SecretTokenFactory } from './sha256-secret-token-factory';

describe('Sha256SecretTokenFactory', () => {
  const factory = new Sha256SecretTokenFactory();

  it('no repite tokens', () => {
    const emitidos = new Set(Array.from({ length: 500 }, () => factory.create().value));

    expect(emitidos.size).toBe(500);
  });

  it('el hash guardado no permite reconstruir el token', () => {
    const { value, hash } = factory.create();

    expect(hash).not.toContain(value);
    expect(hash).toHaveLength(64);
  });

  it('hashea de forma estable, que es lo que permite buscarlo después', () => {
    const { value, hash } = factory.create();

    expect(factory.hash(value)).toBe(hash);
  });

  it('usa un alfabeto seguro para viajar en una URL', () => {
    expect(factory.create().value).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('entrega al menos 256 bits de aleatoriedad', () => {
    // base64url sin relleno: 32 bytes entran en 43 caracteres.
    expect(factory.create().value).toHaveLength(43);
  });
});
