import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Logger } from '@nestjs/common';
import type { ApiEnv } from '../../platform/config/env.module';
import { s3ClientFor } from '../../platform/storage/s3';
import type { JournalPhotos } from '../domain/ports';

/**
 * Las fotos de la bitácora, en el mismo bucket que todo lo demás.
 *
 * **Es el primer sitio del API que escribe bytes.** El resto de las subidas las
 * hace el navegador con una política firmada, y por eso el puerto de las
 * bibliotecas nunca necesitó un `put`: allí el archivo no pasa por el servidor.
 * Acá no hay navegador —el archivo llega de Telegram— así que el servidor es el
 * único que puede escribirlo.
 *
 * El tamaño se conoce **antes** de escribir, porque los bytes ya están en
 * memoria. Es lo que hace que un `PutObject` sea seguro donde una URL de PUT
 * firmada para el navegador no lo sería.
 */
const HOUR_MS = 60 * 60 * 1000;
const MAX_PRESIGN_SECONDS = 7 * 24 * 60 * 60;

export class S3JournalPhotos implements JournalPhotos {
  private readonly logger = new Logger(S3JournalPhotos.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly ttlSeconds: number;

  constructor(env: ApiEnv) {
    this.client = s3ClientFor(env);
    this.bucket = env.STORAGE_BUCKET;
    this.ttlSeconds = env.STORAGE_SIGNED_URL_TTL_SECONDS;
  }

  async put(key: string, bytes: Uint8Array, mimeType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: bytes,
        ContentType: mimeType,
        ContentLength: bytes.byteLength,
      }),
    );
  }

  /**
   * Una URL que no cambia durante la hora.
   *
   * La pantalla se recarga cada minuto; firmando con la hora exacta, cada
   * recarga daba una URL nueva y el navegador volvía a bajar todas las fotos.
   * Firmando con la hora en punto, la URL es la misma hasta la siguiente, y el
   * plazo se alarga esa hora para que siga valiendo lo mismo que antes.
   */
  linkTo(key: string): Promise<string> {
    const signingDate = new Date(Math.floor(Date.now() / HOUR_MS) * HOUR_MS);

    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      signingDate,
      // S3 no firma más de siete días; pasarse haría fallar todas las fotos.
      expiresIn: Math.min(this.ttlSeconds + HOUR_MS / 1000, MAX_PRESIGN_SECONDS),
    });
  }

  /**
   * "Lo mejor que se pueda", igual que los borrados de las bibliotecas: un
   * archivo huérfano es basura que se recoge después, pero una anotación que no
   * se deja borrar es un callejón sin salida.
   */
  async remove(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (caught) {
      this.logger.error(`No se pudo borrar la foto ${key}; queda huérfana.`, caught);
    }
  }
}
