import type { UserId } from '../../shared/identifiers';
import type { Email } from './email';
import type { RefreshToken } from './refresh-token';
import type { User } from './user';

/**
 * Todo lo que identity necesita del mundo exterior, declarado como interfaz.
 * Las implementaciones viven en `infrastructure/` y se cablean en el módulo.
 */

export interface UserRepository {
  findByEmail(email: Email): Promise<User | null>;
  findById(id: UserId): Promise<User | null>;
  /** Falla con `EmailAlreadyRegistered` si el correo ya existe. */
  add(user: User): Promise<void>;
  save(user: User): Promise<void>;
}

export interface RefreshTokenRepository {
  findByHash(tokenHash: string): Promise<RefreshToken | null>;
  add(token: RefreshToken): Promise<void>;
  save(token: RefreshToken): Promise<void>;
  /** Corta de raíz toda una cadena de rotaciones. */
  revokeFamily(familyId: string, now: Date): Promise<void>;
}

export interface EmailVerificationRecord {
  readonly id: string;
  readonly userId: UserId;
  readonly expiresAt: Date;
  readonly usedAt: Date | null;
}

export interface EmailVerificationRepository {
  add(record: EmailVerificationRecord & { tokenHash: string }): Promise<void>;
  findByHash(tokenHash: string): Promise<EmailVerificationRecord | null>;
  markUsed(id: string, now: Date): Promise<void>;
}

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  /**
   * Devuelve además si el hash guardado quedó viejo respecto de los parámetros
   * actuales, para poder re-hashear en el login sin molestar al usuario.
   */
  verify(hash: string, plain: string): Promise<{ matches: boolean; needsRehash: boolean }>;
}

/** Genera secretos opacos y su hash de almacenamiento. */
export interface SecretTokenFactory {
  /** El valor en claro viaja al usuario; el hash es lo único que se guarda. */
  create(): { value: string; hash: string };
  hash(value: string): string;
}

export interface AccessTokenClaims {
  readonly userId: UserId;
  readonly emailVerified: boolean;
}

export interface AccessTokenIssuer {
  issue(claims: AccessTokenClaims): Promise<{ token: string; expiresInSeconds: number }>;
  verify(token: string): Promise<AccessTokenClaims | null>;
}

export interface VerificationMail {
  readonly to: Email;
  readonly displayName: string;
  readonly verificationUrl: string;
}

export interface Mailer {
  sendVerification(mail: VerificationMail): Promise<void>;
}

export const USER_REPOSITORY = Symbol('UserRepository');
export const REFRESH_TOKEN_REPOSITORY = Symbol('RefreshTokenRepository');
export const EMAIL_VERIFICATION_REPOSITORY = Symbol('EmailVerificationRepository');
export const PASSWORD_HASHER = Symbol('PasswordHasher');
export const SECRET_TOKEN_FACTORY = Symbol('SecretTokenFactory');
export const ACCESS_TOKEN_ISSUER = Symbol('AccessTokenIssuer');
export const MAILER = Symbol('Mailer');
