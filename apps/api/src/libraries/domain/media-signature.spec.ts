import { describe, expect, it } from 'vitest';
import { MEDIA_LIMITS } from './media-limits';
import { detectMimeType } from './media-signature';

/** Una cabecera de 64 bytes que empieza con estos y sigue en cero. */
function header(...pieces: (number | string)[]): Uint8Array {
  const head = new Uint8Array(64);
  let at = 0;

  for (const piece of pieces) {
    if (typeof piece === 'number') {
      head[at] = piece;
      at += 1;
    } else {
      for (const character of piece) {
        head[at] = character.charCodeAt(0);
        at += 1;
      }
    }
  }

  return head;
}

/** El tamaño de la caja `ftyp`, que la firma se saltea. */
const BOX = [0x00, 0x00, 0x00, 0x20] as const;

const CASES: readonly (readonly [string, Uint8Array])[] = [
  ['image/jpeg', header(0xff, 0xd8, 0xff, 0xe0)],
  ['image/png', header(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)],
  ['image/gif', header('GIF89a')],
  ['image/webp', header('RIFF', 0x24, 0x00, 0x00, 0x00, 'WEBP')],
  ['audio/wav', header('RIFF', 0x24, 0x00, 0x00, 0x00, 'WAVE')],
  ['audio/ogg', header('OggS')],
  ['video/webm', header(0x1a, 0x45, 0xdf, 0xa3)],
  ['audio/mpeg', header('ID3', 0x03, 0x00)],
  ['audio/mpeg', header(0xff, 0xfb, 0x90)],
  ['audio/aac', header(0xff, 0xf1, 0x50)],
  ['audio/aac', header(0xff, 0xf9, 0x50)],
  // Los tres de abajo comparten la caja `ftyp` y solo los separa la marca.
  ['video/quicktime', header(...BOX, 'ftyp', 'qt  ')],
  ['audio/mp4', header(...BOX, 'ftyp', 'M4A ')],
  ['audio/mp4', header(...BOX, 'ftyp', 'M4B ')],
  ['video/mp4', header(...BOX, 'ftyp', 'isom')],
  ['video/mp4', header(...BOX, 'ftyp', 'mp42')],
];

describe('reconocer el tipo real de un archivo', () => {
  it.each(CASES)('reconoce %s', (expected, head) => {
    expect(detectMimeType(head)).toBe(expected);
  });

  it('no reconoce un HTML aunque venga con nombre de imagen', () => {
    expect(detectMimeType(header('<!doctype html><html>'))).toBeNull();
  });

  it('no reconoce un RIFF que no es ni WebP ni WAV', () => {
    expect(detectMimeType(header('RIFF', 0x24, 0x00, 0x00, 0x00, 'AVI '))).toBeNull();
  });

  it('no reconoce un archivo vacío', () => {
    expect(detectMimeType(new Uint8Array(0))).toBeNull();
  });

  /*
   * Los once bits de sincronía de una trama de audio los cumple cualquier
   * binario que empiece por `FF Ex`. Si la firma se quedara ahí, subir
   * cualquier cosa a las columnas de audio costaría dos bytes.
   */
  it.each([
    ['sincronía de once bits pero no de doce, y capa de ADTS', header(0xff, 0xe0, 0x50)],
    ['versión de MPEG reservada', header(0xff, 0xeb, 0x90)],
    ['bitrate inválido', header(0xff, 0xff, 0xff)],
    ['frecuencia de muestreo reservada', header(0xff, 0xfb, 0x9c)],
    ['índice de muestreo prohibido en ADTS', header(0xff, 0xf1, 0xbc)],
  ])('no acepta como audio una cabecera con %s', (_caso, head) => {
    expect(detectMimeType(head)).toBeNull();
  });

  it('sabe reconocer todos los tipos que decimos aceptar', () => {
    // Si mañana se agrega un mime a los techos y nadie escribe su firma, falla
    // acá, en vez de dejar pasar un archivo que nunca se va a poder verificar.
    const covered = new Set(CASES.map(([mime]) => mime));
    const declared = Object.values(MEDIA_LIMITS).flatMap((limit) => [...limit.mimeTypes]);

    expect(declared.filter((mime) => !covered.has(mime))).toEqual([]);
  });
});
