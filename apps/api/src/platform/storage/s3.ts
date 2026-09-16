import { S3Client } from '@aws-sdk/client-s3';
import type { ApiEnv } from '../config/env.module';

/**
 * El cliente de S3, construido una sola vez.
 *
 * Vivía copiado en `libraries/infrastructure` y en `delivery/infrastructure`,
 * con una nota que decía «el día que un tercer contexto lo necesite, se muda a
 * `platform/storage`». Ese día llegó con la bitácora, que guarda las fotos que
 * entran por el chat.
 *
 * Es cableado, no negocio: cada contexto sigue teniendo su propio adaptador con
 * su propio puerto, y lo único que comparten es cómo se abre la conexión.
 */
export function s3ClientFor(env: ApiEnv): S3Client {
  return new S3Client({
    endpoint: env.STORAGE_ENDPOINT,
    region: env.STORAGE_REGION,
    credentials: {
      accessKeyId: env.STORAGE_ACCESS_KEY,
      secretAccessKey: env.STORAGE_SECRET_KEY,
    },
    // MinIO sirve los buckets por ruta, no por subdominio.
    forcePathStyle: true,
  });
}
