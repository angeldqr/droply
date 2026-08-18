import { MEDIA_FILE_NAME_MAX_LENGTH, MEDIA_LIMITS as CONTRACT_LIMITS } from '@droply/contracts';
import { describe, expect, it } from 'vitest';
import { FILE_NAME_MAX_LENGTH } from './library-item';
import { MEDIA_LIMITS, type MediaKind } from './media-limits';

/**
 * El núcleo no puede importar `@droply/contracts`, así que cada techo está
 * escrito dos veces: una para avisarle al usuario antes de que suba, otra para
 * hacerlo cumplir. Si se separan, el navegador dejaría empezar una subida que
 * el servidor rechaza después sin explicación.
 */
describe('techos de media del dominio y del contrato', () => {
  const kinds: MediaKind[] = ['AUDIO', 'VIDEO', 'IMAGE'];

  it.each(kinds)('coinciden en el tamaño máximo de %s', (kind) => {
    expect(MEDIA_LIMITS[kind].maxBytes).toBe(CONTRACT_LIMITS[kind].maxBytes);
  });

  it.each(kinds)('coinciden en los tipos aceptados de %s', (kind) => {
    expect([...MEDIA_LIMITS[kind].mimeTypes]).toEqual([...CONTRACT_LIMITS[kind].mimeTypes]);
  });

  it('coinciden en el largo del nombre de archivo', () => {
    expect(FILE_NAME_MAX_LENGTH).toBe(MEDIA_FILE_NAME_MAX_LENGTH);
  });
});
