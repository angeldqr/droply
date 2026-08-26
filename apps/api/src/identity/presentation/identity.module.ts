import { Logger, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ENV, type ApiEnv } from '../../platform/config/env.module';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { CLOCK, type Clock } from '../../shared/clock';
import { OWNER_STORAGE, type OwnerStorage } from '../../shared/owner-storage';
import { ID_GENERATOR, type IdGenerator } from '../../shared/identifiers';
import { LoginUseCase } from '../application/login.use-case';
import { LogoutUseCase } from '../application/logout.use-case';
import { RefreshSessionUseCase } from '../application/refresh-session.use-case';
import { RegisterUserUseCase } from '../application/register-user.use-case';
import { ResendVerificationUseCase } from '../application/resend-verification.use-case';
import {
  DeleteAccount,
  ResetAccountPassword,
  SetAccountActive,
} from '../application/account-admin-use-cases';
import { PasswordResetSender } from '../application/password-reset-sender';
import {
  ChangePassword,
  RequestPasswordReset,
  ResetPassword,
} from '../application/password-use-cases';
import { VerificationSender } from '../application/verification-sender';
import { SessionIssuer } from '../application/session-issuer';
import { VerifyEmailUseCase } from '../application/verify-email.use-case';
import {
  ACCESS_TOKEN_ISSUER,
  EMAIL_VERIFICATION_REPOSITORY,
  PASSWORD_RESET_REPOSITORY,
  MAILER,
  PASSWORD_HASHER,
  REFRESH_TOKEN_REPOSITORY,
  SECRET_TOKEN_FACTORY,
  USER_REPOSITORY,
  type AccessTokenIssuer,
  type EmailVerificationRepository,
  type PasswordResetRepository,
  type Mailer,
  type PasswordHasher,
  type RefreshTokenRepository,
  type SecretTokenFactory,
  type UserRepository,
} from '../domain/ports';
import { AdminBootstrap } from '../infrastructure/admin-bootstrap';
import { Argon2PasswordHasher } from '../infrastructure/argon2-password-hasher';
import { JwtAccessTokenIssuer } from '../infrastructure/jwt-access-token-issuer';
import { LoggingMailer } from '../infrastructure/logging-mailer';
import { PrismaEmailVerificationRepository } from '../infrastructure/prisma-email-verification.repository';
import { PrismaPasswordResetRepository } from '../infrastructure/prisma-password-reset.repository';
import { PrismaRefreshTokenRepository } from '../infrastructure/prisma-refresh-token.repository';
import { PrismaUserRepository } from '../infrastructure/prisma-user.repository';
import { Sha256SecretTokenFactory } from '../infrastructure/sha256-secret-token-factory';
import { ResendMailer } from '../infrastructure/resend-mailer';
import { SmtpMailer } from '../infrastructure/smtp-mailer';
import { AuthController } from './auth.controller';
import { AuthenticatedGuard } from './authenticated.guard';
import { IS_PRODUCTION } from './tokens';

/**
 * El composition root del contexto. Los casos de uso son clases planas, sin
 * decoradores de Nest: así `application/` no importa el framework y la regla de
 * dependencia se sostiene sola. El precio es este cableado explícito, que a
 * cambio deja a la vista de qué depende cada cosa.
 */
@Module({
  controllers: [AuthController],
  providers: [
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: SECRET_TOKEN_FACTORY, useClass: Sha256SecretTokenFactory },

    {
      provide: USER_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaUserRepository(prisma),
    },
    {
      provide: REFRESH_TOKEN_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaRefreshTokenRepository(prisma),
    },
    {
      provide: EMAIL_VERIFICATION_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaEmailVerificationRepository(prisma),
    },
    {
      provide: PASSWORD_RESET_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaPasswordResetRepository(prisma),
    },

    {
      provide: ACCESS_TOKEN_ISSUER,
      inject: [ENV],
      useFactory: (env: ApiEnv) =>
        new JwtAccessTokenIssuer(env.JWT_ACCESS_SECRET, env.JWT_ACCESS_TTL),
    },

    {
      provide: MAILER,
      inject: [ENV],
      useFactory: (env: ApiEnv): Mailer => {
        const logger = new Logger('Identity');

        // Se avisa siempre cuál de los dos quedó activo, no solo en el caso
        // raro: un servidor que no manda correos y no se queja es difícil de
        // notar, y uno que escribe enlaces de verificación en el log todavía
        // más peligroso.
        if (env.MAIL_TRANSPORT === 'log') {
          logger.warn(
            'MAIL_TRANSPORT=log: los enlaces de verificación se escriben en la consola y no se envía ningún correo. Solo para desarrollo.',
          );

          return new LoggingMailer();
        }

        if (env.MAIL_TRANSPORT === 'resend') {
          logger.log(`Los correos salen por Resend desde ${env.MAIL_FROM}.`);

          // El esquema del entorno ya exigió la clave para este transporte.
          return new ResendMailer({ apiKey: env.RESEND_API_KEY ?? '', from: env.MAIL_FROM });
        }

        logger.log(`Los correos salen por SMTP hacia ${env.SMTP_HOST}:${env.SMTP_PORT}.`);

        return new SmtpMailer({
          host: env.SMTP_HOST ?? '',
          port: env.SMTP_PORT,
          user: env.SMTP_USER,
          password: env.SMTP_PASSWORD,
          from: env.MAIL_FROM,
        });
      },
    },

    {
      provide: SessionIssuer,
      inject: [
        ACCESS_TOKEN_ISSUER,
        REFRESH_TOKEN_REPOSITORY,
        SECRET_TOKEN_FACTORY,
        ID_GENERATOR,
        CLOCK,
        ENV,
      ],
      useFactory: (
        accessTokens: AccessTokenIssuer,
        refreshTokens: RefreshTokenRepository,
        secrets: SecretTokenFactory,
        ids: IdGenerator,
        clock: Clock,
        env: ApiEnv,
      ) =>
        new SessionIssuer(
          accessTokens,
          refreshTokens,
          secrets,
          ids,
          clock,
          durationToMs(env.JWT_REFRESH_TTL),
        ),
    },

    {
      provide: RegisterUserUseCase,
      inject: [USER_REPOSITORY, PASSWORD_HASHER, VerificationSender, ID_GENERATOR, CLOCK],
      useFactory: (
        users: UserRepository,
        hasher: PasswordHasher,
        sender: VerificationSender,
        ids: IdGenerator,
        clock: Clock,
      ) => new RegisterUserUseCase(users, hasher, sender, ids, clock),
    },

    {
      provide: LoginUseCase,
      inject: [USER_REPOSITORY, PASSWORD_HASHER, SessionIssuer],
      useFactory: (users: UserRepository, hasher: PasswordHasher, sessions: SessionIssuer) =>
        new LoginUseCase(users, hasher, sessions),
    },

    {
      provide: RefreshSessionUseCase,
      inject: [
        REFRESH_TOKEN_REPOSITORY,
        USER_REPOSITORY,
        SECRET_TOKEN_FACTORY,
        SessionIssuer,
        CLOCK,
      ],
      useFactory: (
        refreshTokens: RefreshTokenRepository,
        users: UserRepository,
        secrets: SecretTokenFactory,
        sessions: SessionIssuer,
        clock: Clock,
      ) => new RefreshSessionUseCase(refreshTokens, users, secrets, sessions, clock),
    },

    {
      provide: LogoutUseCase,
      inject: [REFRESH_TOKEN_REPOSITORY, SECRET_TOKEN_FACTORY, CLOCK],
      useFactory: (
        refreshTokens: RefreshTokenRepository,
        secrets: SecretTokenFactory,
        clock: Clock,
      ) => new LogoutUseCase(refreshTokens, secrets, clock),
    },

    {
      provide: AdminBootstrap,
      inject: [USER_REPOSITORY, PASSWORD_HASHER, ID_GENERATOR, CLOCK, ENV],
      useFactory: (
        users: UserRepository,
        hasher: PasswordHasher,
        ids: IdGenerator,
        clock: Clock,
        env: ApiEnv,
      ) =>
        new AdminBootstrap(users, hasher, ids, clock, {
          email: env.ADMIN_EMAIL,
          initialPassword: env.ADMIN_INITIAL_PASSWORD,
          // La zona de la cuenta de administración da igual: no programa
          // envíos. Se toma la del servidor para no inventar una.
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
    },
    {
      provide: VerificationSender,
      inject: [
        EMAIL_VERIFICATION_REPOSITORY,
        SECRET_TOKEN_FACTORY,
        MAILER,
        ID_GENERATOR,
        CLOCK,
        ENV,
      ],
      useFactory: (
        verifications: EmailVerificationRepository,
        secrets: SecretTokenFactory,
        mailer: Mailer,
        ids: IdGenerator,
        clock: Clock,
        env: ApiEnv,
      ) => new VerificationSender(verifications, secrets, mailer, ids, clock, env.WEB_URL),
    },
    {
      provide: ResendVerificationUseCase,
      inject: [USER_REPOSITORY, VerificationSender],
      useFactory: (users: UserRepository, sender: VerificationSender) =>
        new ResendVerificationUseCase(users, sender),
    },
    {
      provide: PasswordResetSender,
      inject: [PASSWORD_RESET_REPOSITORY, SECRET_TOKEN_FACTORY, MAILER, ID_GENERATOR, CLOCK, ENV],
      useFactory: (
        resets: PasswordResetRepository,
        secrets: SecretTokenFactory,
        mailer: Mailer,
        ids: IdGenerator,
        clock: Clock,
        env: ApiEnv,
      ) => new PasswordResetSender(resets, secrets, mailer, ids, clock, env.WEB_URL),
    },
    {
      provide: ChangePassword,
      inject: [USER_REPOSITORY, PASSWORD_HASHER, REFRESH_TOKEN_REPOSITORY, CLOCK],
      useFactory: (
        users: UserRepository,
        hasher: PasswordHasher,
        sessions: RefreshTokenRepository,
        clock: Clock,
      ) => new ChangePassword(users, hasher, sessions, clock),
    },
    {
      provide: RequestPasswordReset,
      inject: [USER_REPOSITORY, PasswordResetSender],
      useFactory: (users: UserRepository, sender: PasswordResetSender) =>
        new RequestPasswordReset(users, sender),
    },
    {
      provide: ResetPassword,
      inject: [
        USER_REPOSITORY,
        PASSWORD_RESET_REPOSITORY,
        SECRET_TOKEN_FACTORY,
        PASSWORD_HASHER,
        REFRESH_TOKEN_REPOSITORY,
        CLOCK,
      ],
      useFactory: (
        users: UserRepository,
        resets: PasswordResetRepository,
        secrets: SecretTokenFactory,
        hasher: PasswordHasher,
        sessions: RefreshTokenRepository,
        clock: Clock,
      ) => new ResetPassword(users, resets, secrets, hasher, sessions, clock),
    },
    {
      provide: ResetAccountPassword,
      inject: [
        USER_REPOSITORY,
        PASSWORD_HASHER,
        REFRESH_TOKEN_REPOSITORY,
        CLOCK,
        SECRET_TOKEN_FACTORY,
      ],
      useFactory: (
        users: UserRepository,
        hasher: PasswordHasher,
        sessions: RefreshTokenRepository,
        clock: Clock,
        secrets: SecretTokenFactory,
      ) => new ResetAccountPassword(users, hasher, sessions, clock, secrets),
    },
    {
      provide: SetAccountActive,
      inject: [USER_REPOSITORY, REFRESH_TOKEN_REPOSITORY, CLOCK],
      useFactory: (users: UserRepository, sessions: RefreshTokenRepository, clock: Clock) =>
        new SetAccountActive(users, sessions, clock),
    },
    {
      provide: DeleteAccount,
      inject: [USER_REPOSITORY, OWNER_STORAGE],
      useFactory: (users: UserRepository, storage: OwnerStorage) =>
        new DeleteAccount(users, storage),
    },
    {
      provide: VerifyEmailUseCase,
      inject: [EMAIL_VERIFICATION_REPOSITORY, USER_REPOSITORY, SECRET_TOKEN_FACTORY, CLOCK],
      useFactory: (
        verifications: EmailVerificationRepository,
        users: UserRepository,
        secrets: SecretTokenFactory,
        clock: Clock,
      ) => new VerifyEmailUseCase(verifications, users, secrets, clock),
    },

    {
      provide: IS_PRODUCTION,
      inject: [ENV],
      useFactory: (env: ApiEnv) => env.NODE_ENV === 'production',
    },

    // Global a propósito: las rutas nacen cerradas y se abren con `@Public()`.
    { provide: APP_GUARD, useClass: AuthenticatedGuard },
  ],
  exports: [ACCESS_TOKEN_ISSUER, USER_REPOSITORY],
})
export class IdentityModule {}

/** Convierte "30d", "15m" o "900" —segundos pelados— a milisegundos. */
function durationToMs(duration: string): number {
  const match = /^(\d+)([smhd]?)$/.exec(duration);

  if (!match?.[1]) {
    throw new Error(`Duración con formato desconocido: ${duration}`);
  }

  const perUnit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;
  const unit = match[2];

  return Number(match[1]) * (unit ? perUnit[unit as keyof typeof perUnit] : 1000);
}
