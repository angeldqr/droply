import { FixedClock } from '../../shared/clock';
import { LoginUseCase } from '../application/login.use-case';
import { LogoutUseCase } from '../application/logout.use-case';
import { RefreshSessionUseCase } from '../application/refresh-session.use-case';
import { RegisterUserUseCase } from '../application/register-user.use-case';
import { SessionIssuer } from '../application/session-issuer';
import { VerifyEmailUseCase } from '../application/verify-email.use-case';
import {
  FakeAccessTokenIssuer,
  FakeHasher,
  FakeSecretTokenFactory,
  InMemoryEmailVerificationRepository,
  InMemoryRefreshTokenRepository,
  InMemoryUserRepository,
  RecordingMailer,
  SequentialIdGenerator,
} from './fakes';

export const REFRESH_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Arma el contexto completo con dobles. Cada test recibe uno nuevo, así que
 * ninguno arrastra el estado del anterior.
 */
export function buildIdentity(startingAt = new Date('2026-08-17T09:00:00.000Z')) {
  const users = new InMemoryUserRepository();
  const refreshTokens = new InMemoryRefreshTokenRepository();
  const verifications = new InMemoryEmailVerificationRepository();
  const hasher = new FakeHasher();
  const secrets = new FakeSecretTokenFactory();
  const accessTokens = new FakeAccessTokenIssuer();
  const mailer = new RecordingMailer();
  const ids = new SequentialIdGenerator();
  const clock = new FixedClock(startingAt);

  const sessions = new SessionIssuer(
    accessTokens,
    refreshTokens,
    secrets,
    ids,
    clock,
    REFRESH_LIFETIME_MS,
  );

  return {
    users,
    refreshTokens,
    verifications,
    hasher,
    secrets,
    accessTokens,
    mailer,
    ids,
    clock,
    sessions,
    register: new RegisterUserUseCase(
      users,
      verifications,
      hasher,
      secrets,
      mailer,
      ids,
      clock,
      'https://droply.test',
    ),
    login: new LoginUseCase(users, hasher, sessions),
    refresh: new RefreshSessionUseCase(refreshTokens, users, secrets, sessions, clock),
    logout: new LogoutUseCase(refreshTokens, secrets, clock),
    verifyEmail: new VerifyEmailUseCase(verifications, users, secrets, clock),
  };
}

export const validRegistration = {
  email: 'Ana@Ejemplo.COM',
  password: 'una frase larga y tranquila',
  displayName: 'Ana',
  timezone: 'America/Bogota',
};
