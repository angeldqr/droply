import type { RecipientId, UserId } from '../../shared/identifiers';
import type { Recipient } from './recipient';

/**
 * Igual que en libraries: el dueño va en la firma de cada lectura, no en un
 * chequeo posterior. La única búsqueda sin dueño es la del código, y es a
 * propósito: quien llega por el enlace todavía no tiene sesión.
 */
export interface RecipientRepository {
  listOwnedBy(ownerId: UserId): Promise<Recipient[]>;
  findOwned(id: RecipientId, ownerId: UserId): Promise<Recipient | null>;
  /** Por el hash del código, que es lo único que trae quien abre el enlace. */
  findByCodeHash(codeHash: string): Promise<Recipient | null>;
  /** Si ese chat ya está vinculado a otro destinatario de la misma cuenta. */
  findLinkedChat(ownerId: UserId, externalId: string): Promise<Recipient | null>;
  add(recipient: Recipient): Promise<void>;
  save(recipient: Recipient): Promise<void>;
  remove(id: RecipientId, ownerId: UserId): Promise<void>;
}

/**
 * El código que viaja en el enlace: el valor en claro, que solo se ve una vez
 * al crearlo, y el hash, que es lo único que se guarda. Van juntos siempre, así
 * que van en un tipo y no en dos campos sueltos que alguien pueda cruzar.
 */
export interface LinkCode {
  readonly value: string;
  readonly hash: string;
}

export interface LinkCodeFactory {
  create(): LinkCode;
  hash(value: string): string;
}

/**
 * Lo que este contexto necesita saber de la cuenta, y nada más.
 *
 * No es un import de identity —los contextos no se importan entre sí— sino un
 * puerto diminuto que el adaptador resuelve contra la base.
 */
export interface AccountStatus {
  hasVerifiedEmail(userId: UserId): Promise<boolean>;
}

/**
 * El canal por el que sale un mensaje.
 *
 * Existe ahora, con un solo método y una sola implementación, porque el envío
 * de la fase 6 va a hablar exactamente por acá y porque la vinculación ya
 * necesita responderle a quien apretó Empezar.
 */
export interface ChannelGateway {
  send(externalId: string, text: string): Promise<void>;
}

export const RECIPIENT_REPOSITORY = Symbol('RecipientRepository');
export const LINK_CODE_FACTORY = Symbol('LinkCodeFactory');
export const ACCOUNT_STATUS = Symbol('AccountStatus');
export const CHANNEL_GATEWAY = Symbol('ChannelGateway');
