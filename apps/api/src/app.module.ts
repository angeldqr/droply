import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { ENV, EnvModule, type ApiEnv } from './platform/config/env.module';
import { DomainErrorFilter } from './platform/http/domain-error.filter';
import { loggerConfig } from './platform/logging/logger.config';
import { PlatformModule } from './platform/platform.module';
import { IdentityModule } from './identity/presentation/identity.module';
import { LibrariesModule } from './libraries/presentation/libraries.module';
import { RecipientsModule } from './recipients/presentation/recipients.module';

@Module({
  imports: [
    EnvModule,
    LoggerModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: ApiEnv) => loggerConfig(env.NODE_ENV !== 'production'),
    }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1_000, limit: 10 },
      { name: 'medium', ttl: 60_000, limit: 120 },
    ]),
    PlatformModule,
    IdentityModule,
    LibrariesModule,
    RecipientsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: DomainErrorFilter },
  ],
})
export class AppModule {}
