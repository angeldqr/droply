import { Global, Module } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ENV, type WorkerEnv } from '../config/env.module';

export const REDIS = Symbol('Redis');

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ENV],
      useFactory: (env: WorkerEnv): Redis =>
        new Redis(env.REDIS_URL, {
          // BullMQ exige que los reintentos no tengan techo, si no da por
          // muerta la conexión ante el primer corte de red.
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        }),
    },
  ],
  exports: [REDIS],
})
export class RedisModule {}
