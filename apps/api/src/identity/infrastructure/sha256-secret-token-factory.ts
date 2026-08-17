import { createHash, randomBytes } from 'node:crypto';
import type { SecretTokenFactory } from '../domain/ports';

export class Sha256SecretTokenFactory implements SecretTokenFactory {
  /**
   * SHA-256 y no argon2, a diferencia de las contraseñas.
   *
   * Estos tokens son 256 bits de aleatoriedad del sistema: no hay diccionario
   * que los adivine, así que el trabajo caro de argon2 no compraría nada y en
   * cambio metería decenas de milisegundos en cada refresco. Lo que sí importa
   * es no guardar el valor en claro, y para eso un hash rápido alcanza.
   */
  create(): { value: string; hash: string } {
    const value = randomBytes(32).toString('base64url');

    return { value, hash: this.hash(value) };
  }

  hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
