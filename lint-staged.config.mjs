/**
 * `lint-staged` ejecuta los comandos desde la raíz del repositorio, y acá no
 * hay ni el binario de ESLint ni un `eslint.config.mjs`: cada paquete tiene el
 * suyo. Por eso el formateo se hace sobre los archivos concretos —prettier sí
 * vive en la raíz— y el lint se delega a turbo, que entra en cada paquete con
 * el directorio de trabajo correcto y aprovecha su caché.
 *
 * Se invoca a `turbo` directo y no `pnpm run lint` a propósito: pnpm valida el
 * estado del workspace antes de correr un script, y ese chequeo se rompe
 * cuando lint-staged tiene el árbol de trabajo guardado en un stash.
 */

const quote = (files) => files.map((file) => `"${file}"`).join(' ');

export default {
  '*.{ts,tsx,mts,cts}': (files) => [`prettier --write ${quote(files)}`, 'turbo run lint'],
  '*.{js,mjs,cjs,jsx}': (files) => [`prettier --write ${quote(files)}`],
  '*.{json,css,yml,yaml}': (files) => [`prettier --write ${quote(files)}`],
};
