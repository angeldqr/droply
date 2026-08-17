import { Global, Module } from '@nestjs/common';
import { loadEnv, workerEnvSchema, type WorkerEnv } from '@droply/contracts';

export const ENV = Symbol('WorkerEnv');
export type { WorkerEnv };

@Global()
@Module({
  providers: [
    {
      provide: ENV,
      useFactory: (): WorkerEnv => loadEnv(workerEnvSchema),
    },
  ],
  exports: [ENV],
})
export class EnvModule {}
