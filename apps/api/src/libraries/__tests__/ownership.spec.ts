import { describe, expect, it } from 'vitest';
import { LibraryId, LibraryItemId } from '../../shared/identifiers';
import { ana, beto, buildLibraries } from './support';

/**
 * Que una biblioteca sea de quien dice ser es la única barrera entre las
 * cuentas. Cada caso de uso que recibe un identificador tiene que filtrar por
 * dueño en la consulta, no comprobarlo después.
 */
async function anaConBiblioteca() {
  const world = buildLibraries();
  const created = await world.create.execute(ana, { name: 'Frases de la mañana' });
  if (!created.ok) throw new Error('no se pudo crear');

  const item = await world.addText.execute(ana, created.value.id, 'Buen día');
  if (!item.ok) throw new Error('no se pudo agregar');

  return { world, libraryId: created.value.id, itemId: item.value.id };
}

describe('propiedad de las bibliotecas', () => {
  it('el listado solo trae las propias', async () => {
    const { world, libraryId } = await anaConBiblioteca();
    await world.create.execute(beto, { name: 'Cosas de Beto' });

    const deAna = await world.list.execute(ana);
    const deBeto = await world.list.execute(beto);

    expect(deAna.map((row) => row.library.id)).toEqual([libraryId]);
    expect(deBeto).toHaveLength(1);
    expect(deBeto[0]?.library.name).toBe('Cosas de Beto');
  });

  it('una biblioteca ajena responde igual que una inexistente', async () => {
    const { world, libraryId } = await anaConBiblioteca();

    const ajena = await world.get.execute(beto, libraryId);
    const inventada = await world.get.execute(
      beto,
      LibraryId.from('00000000-0000-4000-8000-00000000ffff'),
    );

    expect(ajena.ok).toBe(false);
    expect(inventada.ok).toBe(false);
    if (ajena.ok || inventada.ok) return;

    // Si difirieran, probar identificadores diría cuáles existen.
    expect(ajena.error.code).toBe(inventada.error.code);
    expect(ajena.error.message).toBe(inventada.error.message);
  });

  it('no deja renombrar la biblioteca de otro', async () => {
    const { world, libraryId } = await anaConBiblioteca();

    const result = await world.rename.execute(beto, libraryId, { name: 'Mía ahora' });

    expect(result.ok).toBe(false);
    expect(world.libraries.rows.get(libraryId)?.name).toBe('Frases de la mañana');
  });

  it('no deja borrar la biblioteca de otro', async () => {
    const { world, libraryId } = await anaConBiblioteca();

    const result = await world.remove.execute(beto, libraryId);

    expect(result.ok).toBe(false);
    expect(world.libraries.rows.has(libraryId)).toBe(true);
  });

  it('no deja agregar elementos a la biblioteca de otro', async () => {
    const { world, libraryId } = await anaConBiblioteca();

    const result = await world.addText.execute(beto, libraryId, 'Me colé');

    expect(result.ok).toBe(false);
    expect(world.items.columnOf(libraryId, 'TEXT')).toHaveLength(1);
  });

  it('no deja borrar un elemento de la biblioteca de otro', async () => {
    const { world, libraryId, itemId } = await anaConBiblioteca();

    const result = await world.removeItem.execute(beto, libraryId, itemId);

    expect(result.ok).toBe(false);
    expect(world.items.rows.has(itemId)).toBe(true);
  });

  it('no deja reordenar la biblioteca de otro', async () => {
    const { world, libraryId, itemId } = await anaConBiblioteca();

    const result = await world.move.execute(beto, libraryId, itemId, { afterItemId: null });

    expect(result.ok).toBe(false);
  });

  it('borrar una biblioteca se lleva sus elementos', async () => {
    const { world, libraryId, itemId } = await anaConBiblioteca();

    await world.remove.execute(ana, libraryId);

    expect(world.items.rows.has(itemId)).toBe(false);
  });

  it('un elemento de otra biblioteca no se puede borrar desde esta', async () => {
    const { world, itemId } = await anaConBiblioteca();
    const otra = await world.create.execute(ana, { name: 'Otra' });
    if (!otra.ok) throw new Error('no se pudo crear');

    const result = await world.removeItem.execute(ana, otra.value.id, LibraryItemId.from(itemId));

    expect(result.ok).toBe(false);
    expect(world.items.rows.has(itemId)).toBe(true);
  });
});
