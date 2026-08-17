import argon2 from 'argon2';
import type { PasswordHasher } from '../domain/ports';

/**
 * Parámetros de argon2id según la guía de OWASP: 19 MiB de memoria, dos pases
 * y un hilo. El costo real está en la memoria, que es lo que vuelve caro
 * atacar en paralelo con una GPU.
 *
 * Si algún día se suben, `verify` marca los hashes viejos como `needsRehash` y
 * el login los va migrando solo.
 */
const PARAMETERS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export class Argon2PasswordHasher implements PasswordHasher {
  hash(plain: string): Promise<string> {
    return argon2.hash(plain, PARAMETERS);
  }

  async verify(hash: string, plain: string): Promise<{ matches: boolean; needsRehash: boolean }> {
    try {
      const matches = await argon2.verify(hash, plain);

      return {
        matches,
        needsRehash: matches && argon2.needsRehash(hash, PARAMETERS),
      };
    } catch {
      // Un hash corrupto o con un formato que argon2 no reconoce no es motivo
      // para tumbar la petición: es simplemente una credencial que no valida.
      return { matches: false, needsRehash: false };
    }
  }
}
