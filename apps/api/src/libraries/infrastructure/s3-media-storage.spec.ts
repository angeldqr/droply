import { describe, expect, it } from 'vitest';
import type { ApiEnv } from '../../platform/config/env.module';
import { S3MediaStorage } from './s3-media-storage';

/**
 * Un puerto que no escucha nadie. No hace falta simular el SDK: el fallo que
 * interesa es exactamente este, una conexión rechazada.
 */
const APAGADO = {
  STORAGE_ENDPOINT: 'http://127.0.0.1:1',
  STORAGE_REGION: 'us-east-1',
  STORAGE_BUCKET: 'droply-media',
  STORAGE_ACCESS_KEY: 'llave',
  STORAGE_SECRET_KEY: 'secreto',
  STORAGE_SIGNED_URL_TTL_SECONDS: 900,
} as unknown as ApiEnv;

describe('el almacenamiento con el servicio caído', () => {
  const storage = new S3MediaStorage(APAGADO);

  /*
   * Esto es lo que rompió en la máquina del cliente: quitar una tarjeta
   * devolvía 500 porque el borrado del archivo propagaba el ECONNREFUSED, y los
   * elementos a medias no había forma de sacarlos de la pantalla.
   */
  it('borrar un objeto no falla, para no bloquear el borrado del elemento', async () => {
    await expect(storage.remove('ana/biblioteca/elemento')).resolves.toBeUndefined();
  });

  it('vaciar un prefijo tampoco falla, para no bloquear el borrado de la biblioteca', async () => {
    await expect(storage.removeUnder('ana/biblioteca/')).resolves.toBeUndefined();
  });

  it('firmar no toca la red, así que sigue funcionando', async () => {
    // Firmar es criptografía local: la pantalla puede seguir mostrando la
    // biblioteca aunque el almacenamiento esté caído.
    await expect(storage.linkTo('ana/biblioteca/elemento')).resolves.toContain('droply-media');
  });

  it('en cambio inspeccionar sí necesita la red y avisa del fallo', async () => {
    await expect(storage.inspect('ana/biblioteca/elemento')).rejects.toThrow();
  });
});
