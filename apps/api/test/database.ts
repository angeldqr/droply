import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';

/**
 * El esquema contra el que corren las pruebas de extremo a extremo.
 *
 * Va aparte de `public` porque estas pruebas vacían tablas entre casos: contra
 * el esquema de desarrollo, la primera vuelta borraría las bibliotecas de quien
 * esté probando la aplicación.
 *
 * Se eligió un esquema y no una base aparte por una razón práctica: crear una
 * base pide el permiso `CREATEDB`, que el usuario de la aplicación no tiene ni
 * debería tener. Un esquema lo crea cualquiera que sea dueño de la base, así
 * que esto corre sin tocar los permisos de Postgres.
 */
export const TEST_SCHEMA = 'droply_test';

/** La URL de la aplicación, apuntada al esquema de pruebas. */
export function testDatabaseUrl(): string {
  const path = resolve(__dirname, '../../../.env');

  if (existsSync(path)) config({ path, quiet: true });

  const url = process.env['DATABASE_URL'];

  if (!url) throw new Error('Falta DATABASE_URL: las pruebas de extremo a extremo la necesitan.');

  const parsed = new URL(url);
  parsed.searchParams.set('schema', TEST_SCHEMA);

  return parsed.toString();
}
