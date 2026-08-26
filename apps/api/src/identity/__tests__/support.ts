import { FixedClock } from '../../shared/clock';
import {
  DeleteAccount,
  ResetAccountPassword,
  SetAccountActive,
} from '../application/account-admin-use-cases';
import { LoginUseCase } from '../application/login.use-case';
import { PasswordResetSender } from '../application/password-reset-sender';
import {
  ChangePassword,
  RequestPasswordReset,
  ResetPassword,
} from '../application/password-use-cases';
import { LogoutUseCase } from '../application/logout.use-case';
import { RefreshSessionUseCase } from '../application/refresh-session.use-case';
import { RegisterUserUseCase } from '../application/register-user.use-case';
import { ResendVerificationUseCase } from '../application/resend-verification.use-case';
import { VerificationSender } from '../application/verification-sender';
import { SessionIssuer } from '../application/session-issuer';
import { VerifyEmailUseCase } from '../application/verify-email.use-case';
import {
  FakeAccessTokenIssuer,
  FakeHasher,
  FakeSecretTokenFactory,
  InMemoryEmailVerificationRepository,
  InMemoryPasswordResetRepository,
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
  const resets = new InMemoryPasswordResetRepository();
  const hasher = new FakeHasher();
  const secrets = new FakeSecretTokenFactory();
  const accessTokens = new FakeAccessTokenIssuer();
  const mailer = new RecordingMailer();
  const ids = new SequentialIdGenerator();
  const clock = new FixedClock(startingAt);

  const sender = new VerificationSender(
    verifications,
    secrets,
    mailer,
    ids,
    clock,
    'https://reconectate.test',
  );

  const sessions = new SessionIssuer(
    accessTokens,
    refreshTokens,
    secrets,
    ids,
    clock,
    REFRESH_LIFETIME_MS,
  );

  const resetSender = new PasswordResetSender(
    resets,
    secrets,
    mailer,
    ids,
    clock,
    'https://reconectate.test',
  );

  /** Un almacenamiento de mentira que solo apunta a quién se le vació. */
  const storage = {
    emptied: [] as string[],
    removeAllOf(ownerId: string): Promise<void> {
      storage.emptied.push(ownerId);

      return Promise.resolve();
    },
  };

  return {
    users,
    refreshTokens,
    verifications,
    resets,
    storage,
    hasher,
    secrets,
    accessTokens,
    mailer,
    ids,
    clock,
    sessions,
    sender,
    register: new RegisterUserUseCase(users, hasher, sender, ids, clock),
    resendVerification: new ResendVerificationUseCase(users, sender),
    login: new LoginUseCase(users, hasher, sessions),
    refresh: new RefreshSessionUseCase(refreshTokens, users, secrets, sessions, clock),
    logout: new LogoutUseCase(refreshTokens, secrets, clock),
    verifyEmail: new VerifyEmailUseCase(verifications, users, secrets, clock),
    changePassword: new ChangePassword(users, hasher, refreshTokens, clock),
    requestReset: new RequestPasswordReset(users, resetSender),
    resetPassword: new ResetPassword(users, resets, secrets, hasher, refreshTokens, clock),
    resetAccountPassword: new ResetAccountPassword(users, hasher, refreshTokens, clock, secrets),
    setAccountActive: new SetAccountActive(users, refreshTokens, clock),
    deleteAccount: new DeleteAccount(users, storage),
  };
}

export const validRegistration = {
  email: 'Ana@Ejemplo.COM',
  password: 'una frase larga y tranquila',
  displayName: 'Ana',
  timezone: 'America/Bogota',
};
