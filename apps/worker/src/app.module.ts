import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ENV, EnvModule, type WorkerEnv } from './platform/config/env.module';
import { loggerConfig } from './platform/logging/logger.config';
import { RedisModule } from './platform/queue/redis.module';

@Module({
  imports: [
    EnvModule,
    RedisModule,
    LoggerModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: WorkerEnv) => loggerConfig(env.NODE_ENV !== 'production'),
    }),
  ],
})
export class AppModule {}
