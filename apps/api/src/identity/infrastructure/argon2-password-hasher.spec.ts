import argon2 from 'argon2';
import { describe, expect, it } from 'vitest';
import { Argon2PasswordHasher } from './argon2-password-hasher';

const hasher = new Argon2PasswordHasher();
const password = 'una frase larga y tranquila';

// argon2 está calibrado para tardar, así que estos casos tienen más margen que
// el resto de la suite.
describe('Argon2PasswordHasher', { timeout: 20_000 }, () => {
  it('produce un hash que no deja ver la contraseña', async () => {
    const hash = await hasher.hash(password);

    expect(hash).not.toContain(password);
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('da un hash distinto cada vez, porque la sal es nueva', async () => {
    const [uno, otro] = await Promise.all([hasher.hash(password), hasher.hash(password)]);

    expect(uno).not.toBe(otro);
  });

  it('reconoce la contraseña correcta y rechaza la equivocada', async () => {
    const hash = await hasher.hash(password);

    expect((await hasher.verify(hash, password)).matches).toBe(true);
    expect((await hasher.verify(hash, 'otra frase distinta')).matches).toBe(false);
  });

  it('con los parámetros actuales no pide rehash', async () => {
    const hash = await hasher.hash(password);

    expect((await hasher.verify(hash, password)).needsRehash).toBe(false);
  });

  it('pide rehash cuando el hash guardado usa parámetros más flojos', async () => {
    // Simula una cuenta creada antes de subir el costo. Es lo que dispara la
    // migración silenciosa durante el login.
    const viejo = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 4096,
      timeCost: 2,
      parallelism: 1,
    });

    const result = await hasher.verify(viejo, password);

    expect(result.matches).toBe(true);
    expect(result.needsRehash).toBe(true);
  });

  it('ante un hash corrupto responde que no coincide en vez de reventar', async () => {
    await expect(hasher.verify('esto-no-es-un-hash', password)).resolves.toEqual({
      matches: false,
      needsRehash: false,
    });
  });
});
