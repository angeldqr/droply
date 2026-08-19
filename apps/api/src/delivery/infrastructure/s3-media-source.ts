import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { ApiEnv } from '../../platform/config/env.module';
import type { MediaSource } from '../domain/ports';

/**
 * Baja el archivo del almacenamiento para poder subírselo a Telegram.
 *
 * Es un segundo cliente de S3, aparte del que firma las subidas en
 * `libraries/infrastructure`. Compartirlo obligaría a que un contexto importara
 * la infraestructura del otro, que es justo lo que la separación evita; y son
 * quince líneas de configuración, no una pieza que valga la pena centralizar.
 * El día que un tercer contexto lo necesite, se muda a `platform/storage`.
 */
export class S3MediaSource implements MediaSource {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(env: ApiEnv) {
    this.client = new S3Client({
      endpoint: env.STORAGE_ENDPOINT,
      region: env.STORAGE_REGION,
      credentials: {
        accessKeyId: env.STORAGE_ACCESS_KEY,
        secretAccessKey: env.STORAGE_SECRET_KEY,
      },
      // MinIO sirve los buckets por ruta, no por subdominio.
      forcePathStyle: true,
    });

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
