import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';

/**
 * Trae el `.env` de la raíz del monorepo al entorno del proceso.
 *
 * Hay uno solo para todas las apps: tener un `.env` por paquete termina con la
 * contraseña de Postgres escrita en tres lugares y desincronizada en dos.
 *
 * En el contenedor no existe ese archivo —las variables las inyecta compose—,
 * así que si no está, no pasa nada. Lo que falte lo va a gritar la validación
 * del esquema al arrancar.
 */
export function loadDotenv(): void {
  const path = resolve(__dirname, '../../../../../.env');

  if (existsSync(path)) {
    config({ path, quiet: true });
  }
}
