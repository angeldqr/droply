import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { testDatabaseUrl } from './database';

/**
 * Deja el esquema de pruebas al día antes de que corra el primer caso.
 *
 * Las migraciones se aplican tal cual las aplicaría el despliegue, con
 * `migrate deploy`: si una está rota, estas pruebas lo dicen antes que el
 * servidor. Prisma crea el esquema si no existe, así que la primera vez no hace
 * falta preparar nada a mano. Postgres nativo, sin Docker.
 */
export default function setup(): void {
  execFileSync('pnpm', ['prisma', 'migrate', 'deploy'], {
    cwd: resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    stdio: 'inherit',
    shell: true,
  });
}
