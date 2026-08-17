import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';

/** Mismo `.env` de la raíz que usa el API. Ver `apps/api` para el porqué. */
export function loadDotenv(): void {
  const path = resolve(__dirname, '../../../../../.env');

  if (existsSync(path)) {
    config({ path, quiet: true });
  }
}
