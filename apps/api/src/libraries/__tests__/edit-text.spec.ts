import { describe, expect, it } from 'vitest';
import { LibraryId, LibraryItemId } from '../../shared/identifiers';
import { LibraryItem } from '../domain/library-item';
import { ana, beto, buildLibraries } from './support';

async function unTexto() {
  const world = buildLibraries();
  const created = await world.create.execute(ana, { name: 'Frases' });
  if (!created.ok) throw new Error('no se pudo crear');

  const item = await world.addText.execute(ana, created.value.id, 'Buen dia');
  if (!item.ok) throw new Error('no se pudo agregar');

  return { world, libraryId: created.value.id, itemId: item.value.id };
}

describe('corregir un texto', () => {
  it('guarda el texto nuevo, sin espacios de sobra', async () => {
    const { world, libraryId, itemId } = await unTexto();

    const editado = await world.editText.execute(ana, libraryId, itemId, '  Buen día  ');

    expect(editado.ok).toBe(true);
    expect((await world.items.findInLibrary(itemId, libraryId))?.toSnapshot().textContent).toBe(
      'Buen día',
    );
  });

  it('no lo deja vacío', async () => {
    const { world, libraryId, itemId } = await unTexto();

    const editado = await world.editText.execute(ana, libraryId, itemId, '   ');

    expect(editado.ok ? '' : editado.error.code).toBe('item.text_empty');
  });

  it('el de otra cuenta no existe', async () => {
    const { world, libraryId, itemId } = await unTexto();

    const editado = await world.editText.execute(beto, libraryId, itemId, 'Hola');

    expect(editado.ok).toBe(false);
  });

  it('una foto no se edita: se cambia por otra', () => {
    const foto = LibraryItem.media({
      id: LibraryItemId.from('00000000-0000-4000-8000-000000000001'),
      libraryId: LibraryId.from('00000000-0000-4000-8000-000000000002'),
      kind: 'IMAGE',
      position: 1,
      fileName: 'foto.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 100,
      storageKey: 'clave',
      now: new Date(),
    });
    if (!foto.ok) throw foto.error;

    const editado = foto.value.editText('Hola');

    expect(editado.ok ? '' : editado.error.code).toBe('item.not_text');
  });
});
