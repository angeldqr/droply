'use client';

/**
 * Encoge una imagen en el navegador antes de subirla.
 *
 * El techo de diez megas no es de Droply: es lo que acepta el Bot API de
 * Telegram en una foto. Antes ese techo rechazaba el archivo y el usuario tenía
 * que arreglárselas; ahora se comprime acá y el techo se aplica al resultado.
 *
 * Va en el navegador y no en el servidor a propósito: la máquina tiene un solo
 * núcleo, y ponerlo a redimensionar imágenes es quitarle el núcleo al envío de
 * las 6 de la mañana. Acá la CPU la pone quien sube.
 *
 * ponytail: solo imágenes. Audio y vídeo siguen con su tope, porque
 * recomprimirlos pide WebCodecs en el navegador o ffmpeg en el servidor; entra
 * cuando alguien tenga de verdad un vídeo de más de cincuenta megas que mandar.
 */

/**
 * Telegram no acepta una foto cuyos lados sumen más de 10000 px ni con una
 * proporción de más de 20:1. Con 2560 en el lado mayor las dos cosas sobran, y
 * es de largo más de lo que se ve en un teléfono.
 */
const MAX_SIDE = 2560;

/** De mejor a peor. Se para en la primera que quepa. */
const QUALITIES = [0.92, 0.85, 0.75, 0.6];

/**
 * Devuelve el archivo comprimido, o el original si comprimir no ayuda.
 *
 * Nunca lanza: si algo falla —un formato que el navegador no sabe decodificar,
 * un canvas contaminado, un navegador viejo— devuelve lo que le dieron y deja
 * que la validación de siempre decida. Comprimir es una mejora, no un peaje.
 */
export async function compressImage(file: File, maxBytes: number): Promise<File> {
  // Un GIF se recomprime a una imagen fija: se perdería la animación, que suele
  // ser la única razón por la que alguien sube un GIF.
  if (file.type === 'image/gif') return file;

  if (typeof createImageBitmap !== 'function') return file;

  let bitmap: ImageBitmap | null = null;

  try {
    bitmap = await createImageBitmap(file);

    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');

    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext('2d');
    if (!context) return file;

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    let smallest: Blob | null = null;

    for (const quality of QUALITIES) {
      const blob = await toBlob(canvas, quality);
      if (!blob) return file;

      smallest = blob;
      if (blob.size <= maxBytes) break;
    }

    // Si el resultado no es más chico, el original ya estaba bien comprimido y
    // volver a codificarlo solo habría perdido calidad a cambio de nada.
    if (!smallest || smallest.size >= file.size) return file;

    return new File([smallest], webpName(file.name), {
      type: 'image/webp',
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}

/** `canvas.toBlob` es de callback; el resto de este archivo no. */
function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/webp', quality);
  });
}

function webpName(name: string): string {
  const dot = name.lastIndexOf('.');

  return `${dot > 0 ? name.slice(0, dot) : name}.webp`;
}
