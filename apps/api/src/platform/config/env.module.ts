import { Global, Module } from '@nestjs/common';
import { apiEnvSchema, loadEnv, type ApiEnv } from '@reconectate/contracts';

export const ENV = Symbol('ApiEnv');
export type { ApiEnv };

/**
 * Lee el entorno una sola vez, al construir el módulo. Si algo falta, Nest
 * nunca llega a levantar y el error sale en el arranque.
 */
@Global()
@Module({
  providers: [
    {
      provide: ENV,
      useFactory: (): ApiEnv => loadEnv(apiEnvSchema),
    },
  ],
  exports: [ENV],
})
export class EnvModule {}
