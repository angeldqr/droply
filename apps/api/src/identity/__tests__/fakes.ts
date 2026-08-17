import type { Email } from '../domain/email';
import { EmailAlreadyRegistered } from '../domain/errors';
import type {
  AccessTokenClaims,
  AccessTokenIssuer,
  EmailVerificationRecord,
  EmailVerificationRepository,
  Mailer,
  PasswordHasher,
  RefreshTokenRepository,
  SecretTokenFactory,
  UserRepository,
  VerificationMail,
} from '../domain/ports';
import { RefreshToken } from '../domain/refresh-token';
import type { User } from '../domain/user';
import type { IdGenerator } from '../../shared/identifiers';
import type { UserId } from '../../shared/identifiers';

/**
 * Dobles en memoria para probar los casos de uso sin base de datos. Guardan
 * estado de verdad —no devuelven respuestas fijas— así que las pruebas
 * ejercitan la lógica real de rotación y revocación.
 */

export class InMemoryUserRepository implements UserRepository {
  readonly rows = new Map<string, User>();

  findByEmail(email: Email): Promise<User | null> {
    for (const user of this.rows.values()) {
      if (user.email.equals(email)) return Promise.resolve(user);
    }

    return Promise.resolve(null);
  }

  findById(id: UserId): Promise<User | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }

  async add(user: User): Promise<void> {
    // Reproduce el índice único de la base, que es lo que garantiza la
    // unicidad de verdad cuando dos registros llegan a la vez.
    if (await this.findByEmail(user.email)) throw new EmailAlreadyRegistered();

    this.rows.set(user.id, user);
  }

  save(user: User): Promise<void> {
    this.rows.set(user.id, user);

    return Promise.resolve();
  }
}

export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  readonly rows = new Map<string, RefreshToken>();

  findByHash(tokenHash: string): Promise<RefreshToken | null> {
    for (const token of this.rows.values()) {
      if (token.tokenHash === tokenHash) return Promise.resolve(token);
    }

    return Promise.resolve(null);
  }

  add(token: RefreshToken): Promise<void> {
    this.rows.set(token.id, token);

    return Promise.resolve();
  }

  save(token: RefreshToken): Promise<void> {
    this.rows.set(token.id, token);

    return Promise.resolve();
  }

  revokeFamily(familyId: string, now: Date): Promise<void> {
    for (const [id, token] of this.rows) {
      const snapshot = token.toSnapshot();

      if (snapshot.familyId === familyId && snapshot.revokedAt === null) {
        this.rows.set(id, RefreshToken.fromSnapshot({ ...snapshot, revokedAt: now }));
      }
    }

    return Promise.resolve();
  }
}

export class InMemoryEmailVerificationRepository implements EmailVerificationRepository {
  readonly rows = new Map<string, EmailVerificationRecord & { tokenHash: string }>();

  add(record: EmailVerificationRecord & { tokenHash: string }): Promise<void> {
    this.rows.set(record.id, record);

    return Promise.resolve();
  }

  findByHash(tokenHash: string): Promise<EmailVerificationRecord | null> {
    for (const row of this.rows.values()) {
      if (row.tokenHash === tokenHash) return Promise.resolve(row);
    }

    return Promise.resolve(null);
  }

  markUsed(id: string, now: Date): Promise<void> {
    const row = this.rows.get(id);
    if (row) this.rows.set(id, { ...row, usedAt: now });

    return Promise.resolve();
  }
}

/** Hash reversible y barato: argon2 tardaría segundos en cada test. */
export class FakeHasher implements PasswordHasher {
  needsRehashNext = false;

  hash(plain: string): Promise<string> {
    return Promise.resolve(`hashed:${plain}`);
  }

  verify(hash: string, plain: string): Promise<{ matches: boolean; needsRehash: boolean }> {
    return Promise.resolve({
      matches: hash === `hashed:${plain}`,
      needsRehash: this.needsRehashNext,
    });
  }
}

export class FakeSecretTokenFactory implements SecretTokenFactory {
  private counter = 0;

  create(): { value: string; hash: string } {
    const value = `secreto-${++this.counter}`;

    return { value, hash: this.hash(value) };
  }

  hash(value: string): string {
    return `hash(${value})`;
  }
}

export class FakeAccessTokenIssuer implements AccessTokenIssuer {
  private readonly issued = new Map<string, AccessTokenClaims>();
  private counter = 0;

  issue(claims: AccessTokenClaims): Promise<{ token: string; expiresInSeconds: number }> {
    const token = `acceso-${++this.counter}`;
    this.issued.set(token, claims);

    return Promise.resolve({ token, expiresInSeconds: 900 });
  }

  verify(token: string): Promise<AccessTokenClaims | null> {
    return Promise.resolve(this.issued.get(token) ?? null);
  }
}

export class RecordingMailer implements Mailer {
  readonly sent: VerificationMail[] = [];

  sendVerification(mail: VerificationMail): Promise<void> {
    this.sent.push(mail);

    return Promise.resolve();
  }

  get lastUrl(): string {
    const last = this.sent.at(-1);
    if (!last) throw new Error('No se mandó ningún correo.');

    return last.verificationUrl;
  }

  /** El token que viaja en el enlace, que es lo que el usuario devuelve. */
  get lastToken(): string {
    return new URL(this.lastUrl).searchParams.get('token') ?? '';
  }
}

/** Ids predecibles: los tests pueden afirmar sobre ellos. */
export class SequentialIdGenerator implements IdGenerator {
  private counter = 0;

  generate(): string {
    this.counter += 1;

    return `00000000-0000-4000-8000-${String(this.counter).padStart(12, '0')}`;
  }
}
