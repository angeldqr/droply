/**
 * Qué es de verdad un archivo, leyendo sus primeros bytes.
 *
 * El tipo que declara el navegador sale de la extensión del nombre, así que no
 * prueba nada: renombrar un `.html` a `.png` basta para que diga `image/png`.
 * Acá se mira el contenido.
 *
 * Solo distingue los doce tipos que aceptamos. Cualquier otra cosa devuelve
 * `null`, que es exactamente lo que hace falta: el vocabulario es cerrado y no
 * existe el caso "es válido pero no lo reconozco".
 */

/** Con 64 bytes alcanza para todas las firmas de acá. */
export const SIGNATURE_BYTES = 64;

export function detectMimeType(head: Uint8Array): string | null {
  if (matches(head, 0, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (matches(head, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (matches(head, 0, ascii('GIF8'))) return 'image/gif';
  if (matches(head, 0, ascii('OggS'))) return 'audio/ogg';
  if (matches(head, 0, [0x1a, 0x45, 0xdf, 0xa3])) return 'video/webm';
  if (matches(head, 0, ascii('ID3'))) return 'audio/mpeg';

  // RIFF es solo el envoltorio: el formato está en los cuatro bytes que siguen
  // al tamaño.
  if (matches(head, 0, ascii('RIFF'))) {
    if (matches(head, 8, ascii('WEBP'))) return 'image/webp';
    if (matches(head, 8, ascii('WAVE'))) return 'audio/wav';

    return null;
  }

  // La familia MP4 comparte la caja `ftyp`. La marca que viene detrás es lo
  // único que separa un video de un audio y de un .mov.
  if (matches(head, 4, ascii('ftyp'))) {
    if (matches(head, 8, ascii('qt  '))) return 'video/quicktime';
    if (matches(head, 8, ascii('M4A')) || matches(head, 8, ascii('M4B'))) return 'audio/mp4';

    return 'video/mp4';
  }

  // Sin etiqueta ID3, un MP3 empieza directo en la cabecera de trama, que
  // comparte los primeros once bits de sincronía con un AAC en ADTS.
  //
  // No alcanza con mirar esos once bits: cualquier binario que empiece por
  // `FF Ex` los cumple, y eso convertiría la verificación de las dos columnas
  // de audio en un trámite de dos bytes. Hay que descartar además las
  // combinaciones que el formato declara reservadas o inválidas, que es lo que
  // ningún archivo real trae.
  return frameHeader(head);
}

function frameHeader(head: Uint8Array): string | null {
  const [first, second, third] = [head[0], head[1], head[2]];

  if (first !== 0xff || second === undefined || third === undefined) return null;
  if ((second & 0xe0) !== 0xe0) return null;

  // Los dos bits de capa en cero significan ADTS: el AAC no tiene capas.
  if (((second >> 1) & 0x03) === 0) {
    // La sincronía del ADTS son doce bits, no once.
    if ((second & 0xf0) !== 0xf0) return null;

    // El índice de frecuencia de muestreo llega hasta el 12; del 13 en adelante
    // está reservado o prohibido.
    return ((third >> 2) & 0x0f) <= 12 ? 'audio/aac' : null;
  }

  // Versión 01 reservada, bitrate 1111 inválido, muestreo 11 reservado.
  if (((second >> 3) & 0x03) === 0x01) return null;
  if (((third >> 4) & 0x0f) === 0x0f) return null;
  if (((third >> 2) & 0x03) === 0x03) return null;

  return 'audio/mpeg';
}

function matches(head: Uint8Array, at: number, signature: readonly number[]): boolean {
  return signature.every((byte, index) => head[at + index] === byte);
}

function ascii(text: string): number[] {
  return [...text].map((character) => character.charCodeAt(0));
}
