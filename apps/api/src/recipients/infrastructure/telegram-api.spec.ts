import { describe, expect, it } from 'vitest';
import { parseIncoming } from './telegram-api';

function conFoto(photo: unknown): unknown {
  return { message: { chat: { id: 7 }, photo } };
}

/*
 * Telegram manda cada foto en varios tamaños, de menor a mayor. Se guarda la
 * grande y, para las rejillas, la primera que llegue a 600 px de lado.
 */
describe('las fotos que entran por el bot', () => {
  it('guarda la grande y elige una mediana como miniatura', () => {
    const parsed = parseIncoming(
      conFoto([
        { file_id: 's', width: 90, height: 67 },
        { file_id: 'm', width: 320, height: 240 },
        { file_id: 'x', width: 800, height: 600 },
        { file_id: 'y', width: 1280, height: 960 },
      ]),
    );

    expect(parsed?.photo).toEqual({ fileId: 'y', thumbFileId: 'x' });
  });

  it('una foto vertical se mide por su lado mayor', () => {
    const parsed = parseIncoming(
      conFoto([
        { file_id: 'm', width: 240, height: 320 },
        { file_id: 'x', width: 450, height: 600 },
        { file_id: 'y', width: 960, height: 1280 },
      ]),
    );

    expect(parsed?.photo?.thumbFileId).toBe('x');
  });

  it('si ninguna llega al tamaño, la miniatura es la misma foto', () => {
    const parsed = parseIncoming(conFoto([{ file_id: 's', width: 90, height: 90 }]));

    expect(parsed?.photo).toEqual({ fileId: 's', thumbFileId: 's' });
  });

  it('sin foto, no inventa ninguna', () => {
    expect(parseIncoming(conFoto('basura'))?.photo).toBeNull();
  });
});
