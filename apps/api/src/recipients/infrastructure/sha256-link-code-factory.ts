import { createHash, randomBytes } from 'node:crypto';
import type { LinkCode, LinkCodeFactory } from '../domain/ports';

/**
 * El código que viaja en el enlace del bot.
 *
 * Dieciséis bytes y no treinta y dos, a diferencia de los tokens de sesión: el
 * `start` de Telegram admite 64 caracteres y solo del juego `A-Za-z0-9_-`, que
 * es justo lo que produce base64url. Ciento veintiocho bits siguen estando muy
 * por encima de lo que se puede adivinar, y el código vive un día.
 *
 * Se guarda hasheado con SHA-256: es aleatoriedad del sistema, no una clave que
 * alguien pueda buscar en un diccionario, así que el trabajo caro de argon2 no
 * compraría nada acá.
 */
export class Sha256LinkCodeFactory implements LinkCodeFactory {
  create(): LinkCode {
    const value = randomBytes(16).toString('base64url');

    return { value, hash: this.hash(value) };
  }

  hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
