import { describe, expect, it } from 'vitest';
import { ana, buildLibraries } from './support';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const UN_DIA = 24 * 60 * 60 * 1000;

/** Pide el permiso; sube los bytes solo si se le dice, como haría el navegador. */
async function conPermiso(world: ReturnType<typeof buildLibraries>, sube: boolean) {
  const library = await world.create.execute(ana, { name: 'Cosas' });
  if (!library.ok) throw new Error('no se pudo crear la biblioteca');

  const started = await world.requestUpload.execute(ana, library.value.id, {
    kind: 'IMAGE',
    fileName: 'foto.png',
    mimeType: 'image/png',
    sizeBytes: PNG.length,
  });
  if (!started.ok) throw new Error('no se pudo firmar el permiso');

  const { id, storageKey } = started.value.item;
  if (sube && storageKey) world.storage.put(storageKey, PNG);

  return { libraryId: library.value.id, itemId: id, storageKey: storageKey ?? '' };
}

/**
 * Pedir el permiso crea la fila antes de que el archivo exista. Si el navegador
 * se cae o el usuario se arrepiente, esa fila se queda para siempre, y con ella
 * el objeto a medio subir que nadie va a reclamar.
 */
describe('barrido de subidas a medias', () => {
  it('recoge la fila y el objeto de una subida que nunca se confirmó', async () => {
    const world = buildLibraries();
    const { libraryId, itemId, storageKey } = await conPermiso(world, true);

    world.clock.advanceBy(UN_DIA + 1);

    expect(await world.sweepUploads.execute()).toBe(1);

    const contents = await world.get.execute(ana, libraryId);

    expect(contents.ok).toBe(true);
    if (contents.ok) expect(contents.value.items.map((item) => item.id)).not.toContain(itemId);
    expect(world.storage.objects.has(storageKey)).toBe(false);
  });

  it('no toca la de hace un rato: puede estar subiendo ahora mismo', async () => {
    const world = buildLibraries();
    await conPermiso(world, false);

    world.clock.advanceBy(UN_DIA - 1);

    expect(await world.sweepUploads.execute()).toBe(0);
  });

  it('no toca lo que sí se confirmó, por viejo que sea', async () => {
    const world = buildLibraries();
    const { libraryId, itemId, storageKey } = await conPermiso(world, true);

    expect((await world.confirmUpload.execute(ana, libraryId, itemId)).ok).toBe(true);

    world.clock.advanceBy(365 * UN_DIA);

    expect(await world.sweepUploads.execute()).toBe(0);
    expect(world.storage.objects.has(storageKey)).toBe(true);
  });

  it('un texto no tiene archivo que recoger', async () => {
    const world = buildLibraries();
    const library = await world.create.execute(ana, { name: 'Frases' });
    if (!library.ok) throw new Error('no se pudo crear la biblioteca');

    await world.addText.execute(ana, library.value.id, 'Buen día');
    world.clock.advanceBy(365 * UN_DIA);

    expect(await world.sweepUploads.execute()).toBe(0);
  });
});
