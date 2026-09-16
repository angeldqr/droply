import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import type { ApiEnv } from '../../platform/config/env.module';
import { s3ClientFor } from '../../platform/storage/s3';
import type { MediaSource } from '../domain/ports';

/**
 * Baja el archivo del almacenamiento para poder subírselo a Telegram.
 *
 * El puerto y el adaptador son de este contexto; lo único compartido es cómo se
 * abre la conexión, que vive en `platform/storage` desde que la bitácora se
 * convirtió en el tercero que la necesitaba.
 */
export class S3MediaSource implements MediaSource {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(env: ApiEnv) {
    this.client = s3ClientFor(env);
    this.bucket = env.STORAGE_BUCKET;
  }

  async bytesOf(storageKey: string): Promise<Uint8Array> {
    const object = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }),
    );

    if (!object.Body) throw new Error(`El objeto ${storageKey} vino vacío.`);

    // Entero en memoria: el techo de una subida son cincuenta megas, que es
    // también el que acepta Telegram de un bot. Con archivos más grandes habría
    // que ir por partes, pero entonces tampoco se podrían enviar.
    return object.Body.transformToByteArray();
  }
}
