import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Logger } from '@nestjs/common';
import type { ApiEnv } from '../../platform/config/env.module';
import { SIGNATURE_BYTES } from '../domain/media-signature';
import type { MediaStorage, UploadTicket } from '../domain/ports';

export class S3MediaStorage implements MediaStorage {
  private readonly logger = new Logger(S3MediaStorage.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly ttlSeconds: number;

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
    this.ttlSeconds = env.STORAGE_SIGNED_URL_TTL_SECONDS;
  }

  async ticketFor(key: string, mimeType: string, maxBytes: number): Promise<UploadTicket> {
    const { url, fields } = await createPresignedPost(this.client, {
      Bucket: this.bucket,
      Key: key,
      Expires: this.ttlSeconds,
      Fields: { 'Content-Type': mimeType },
      /*
       * Las dos condiciones las hace cumplir el almacenamiento, que corta la
       * subida antes de escribir nada. Una URL de PUT firmada no puede hacer
       * esto: aceptaría cualquier tamaño, y solo nos enteraríamos al confirmar,
       * con el disco ya lleno y sin nadie obligado a confirmar.
       */
      Conditions: [
        ['content-length-range', 1, maxBytes],
        ['eq', '$Content-Type', mimeType],
      ],
    });

    return { url, fields };
  }

  async inspect(key: string): Promise<{ sizeBytes: number; head: Uint8Array } | null> {
    try {
      // Un solo pedido: la cabecera `Content-Range` de una lectura parcial trae
      // el tamaño total detrás de la barra, así que no hace falta un HEAD.
      const object = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Range: `bytes=0-${SIGNATURE_BYTES - 1}`,
        }),
      );

      const sizeBytes = totalOf(object.ContentRange);

      /*
       * Sin `Content-Range` no se sabe cuánto pesa el objeto entero, y
       * `ContentLength` acá vale 64: son los bytes del rango, no del archivo.
       * Tomarlo como tamaño dejaría pasar cualquier cosa por debajo del techo.
       * Un almacenamiento que atiende un rango tiene que devolver la cabecera,
       * así que si falta, se trata como si el archivo no estuviera.
       */
      if (!object.Body || sizeBytes === null) return null;

      return { sizeBytes, head: await object.Body.transformToByteArray() };
    } catch (caught) {
      if (isMissing(caught)) return null;

      throw caught;
    }
  }

  async copy(fromKey: string, toKey: string): Promise<void> {
    // El objeto se duplica dentro del almacenamiento; los bytes no pasan por
    // acá. `CopySource` va codificado porque es una ruta dentro de una URL.
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        Key: toKey,
        CopySource: encodeURI(`${this.bucket}/${fromKey}`),
      }),
    );
  }

  linkTo(key: string): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: this.ttlSeconds,
    });
  }

  /*
   * Borrar el archivo es "lo mejor que se pueda", nunca una condición para
   * borrar el elemento.
   *
   * Si el almacenamiento no responde y esto propagara el error, quitar una
   * tarjeta o una biblioteca devolvería un 500 y el usuario se quedaría con
   * elementos que no puede sacar de la pantalla. Un archivo huérfano es basura
   * que se recoge después; un elemento que no se deja borrar es un callejón sin
   * salida. Queda registrado en el log para poder barrerlo.
   */
  async remove(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (caught) {
      this.logger.error(`No se pudo borrar el objeto ${key}; queda huérfano.`, caught);
    }
  }

  async removeUnder(prefix: string): Promise<void> {
    try {
      await this.deleteEverythingUnder(prefix);
    } catch (caught) {
      this.logger.error(`No se pudo vaciar ${prefix}; quedan objetos huérfanos.`, caught);
    }
  }

  private async deleteEverythingUnder(prefix: string): Promise<void> {
    let continuationToken: string | undefined;

    do {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );

      const keys = (page.Contents ?? []).flatMap((object) =>
        object.Key === undefined ? [] : [{ Key: object.Key }],
      );

      if (keys.length > 0) {
        await this.client.send(
          new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: keys } }),
        );
      }

      continuationToken = page.NextContinuationToken;
    } while (continuationToken !== undefined);
  }
}

/** `bytes 0-63/1048576` — lo que importa es lo que va detrás de la barra. */
function totalOf(contentRange: string | undefined): number | null {
  const total = Number(contentRange?.split('/')[1]);

  return Number.isFinite(total) ? total : null;
}

function isMissing(caught: unknown): boolean {
  if (typeof caught !== 'object' || caught === null) return false;

  const error = caught as { name?: unknown; $metadata?: { httpStatusCode?: unknown } };

  return error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404;
}
