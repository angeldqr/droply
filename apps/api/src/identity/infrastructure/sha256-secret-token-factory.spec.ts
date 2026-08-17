import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Sha256SecretTokenFactory } from './sha256-secret-token-factory';

describe('Sha256SecretTokenFactory', () => {
  const factory = new Sha256SecretTokenFactory();

  it('no repite tokens', () => {
    const emitidos = new Set(Array.from({ length: 500 }, () => factory.create().value));

    expect(emitidos.size).toBe(500);
  });

  it('guarda un SHA-256 y no el token', () => {
    const { value, hash } = factory.create();

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // Comparar substrings no probaría nada: uno es hexadecimal y el otro
    // base64url, así que nunca se contendrían aunque el hash fuera el valor.
    expect(hash).toBe(createHash('sha256').update(value).digest('hex'));
  });

  it('hashea de forma estable, que es lo que permite buscarlo después', () => {
    const { value, hash } = factory.create();

    expect(factory.hash(value)).toBe(hash);
  });

  it('usa un alfabeto seguro para viajar en una URL', () => {
    expect(factory.create().value).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('entrega 32 bytes de aleatoriedad', () => {
    const { value } = factory.create();

    // El largo del texto solo insinúa el tamaño; lo que importa es cuántos
    // bytes decodifica.
    expect(Buffer.from(value, 'base64url')).toHaveLength(32);
  });
});
