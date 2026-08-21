import { defineConfig } from 'vitest/config';

/**
 * Las pruebas de extremo a extremo van aparte de `vitest.config.ts` a propósito:
 * necesitan Postgres levantado y tardan segundos, y `pnpm test` tiene que poder
 * correr en cualquier sitio y en menos de cinco.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.e2e.spec.ts'],
    globalSetup: ['test/global-setup.ts'],
    // Comparten una sola base: dos archivos a la vez se borrarían las filas.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
