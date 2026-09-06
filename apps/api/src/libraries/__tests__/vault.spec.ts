import { describe, expect, it } from 'vitest';
import { LibraryItemId, type LibraryId } from '../../shared/identifiers';
import { ana, beto, buildLibraries } from './support';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

type World = ReturnType<typeof buildLibraries>;

/** Deja una imagen verificada en el baúl de Ana y devuelve su identificador. */
async function imagenEnElBaul(world: World, vaultId: LibraryId) {
  const started = await world.requestUpload.execute(ana, vaultId, {
    kind: 'IMAGE',
    fileName: 'gato.png',
    mimeType: 'image/png',
    sizeBytes: PNG.length,
  });

  if (!started.ok || !started.value.item.storageKey) throw new Error('no se firmó el permiso');

  world.storage.put(started.value.item.storageKey, PNG);
  await world.confirmUpload.execute(ana, vaultId, started.value.item.id);

  return { itemId: started.value.item.id, storageKey: started.value.item.storageKey };
}

describe('el baúl', () => {
  it('se crea la primera vez que se abre y después es siempre el mismo', async () => {
    const world = buildLibraries();

    const first = await world.openVault.execute(ana);
    const second = await world.openVault.execute(ana);

    expect(second.library.id).toBe(first.library.id);
    expect(first.library.isVault).toBe(true);
  });

  it('no aparece en el listado de bibliotecas', async () => {
    const world = buildLibraries();

    await world.openVault.execute(ana);
    await world.create.execute(ana, { name: 'Cosas' });

    const listed = await world.list.execute(ana);

    expect(listed).toHaveLength(1);
    expect(listed[0]?.library.name).toBe('Cosas');
  });

  it('no se puede renombrar ni borrar', async () => {
    const world = buildLibraries();
    const vault = await world.openVault.execute(ana);

    expect((await world.rename.execute(ana, vault.library.id, { name: 'Otro' })).ok).toBe(false);
    expect((await world.remove.execute(ana, vault.library.id)).ok).toBe(false);
    expect(world.libraries.rows.has(vault.library.id)).toBe(true);
  });

  it('copia un archivo a una biblioteca sin sacarlo del baúl', async () => {
    const world = buildLibraries();
    const vault = await world.openVault.execute(ana);
    const created = await world.create.execute(ana, { name: 'Cosas' });

    if (!created.ok) throw new Error('no se creó la biblioteca');

    const original = await imagenEnElBaul(world, vault.library.id);
    const copied = await world.copyFromVault.execute(ana, created.value.id, [original.itemId]);

    expect(copied.ok).toBe(true);
    if (!copied.ok) return;

    // Copia, no mudanza: el original sigue en el baúl con su propio archivo.
    expect(await world.items.findInLibrary(original.itemId, vault.library.id)).not.toBeNull();
    expect(world.storage.objects.has(original.storageKey)).toBe(true);

    // Y la copia nace lista, con archivo propio y sin volver a confirmarse.
    const copia = copied.value[0];

    expect(copia?.storageKey).not.toBe(original.storageKey);
    expect(copia?.isReady).toBe(true);
    expect(copia?.fileName).toBe('gato.png');
    expect(world.storage.objects.get(copia?.storageKey ?? '')).toEqual(PNG);
  });

  it('quitar la copia no toca el archivo del original', async () => {
    const world = buildLibraries();
    const vault = await world.openVault.execute(ana);
    const created = await world.create.execute(ana, { name: 'Cosas' });

    if (!created.ok) throw new Error('no se creó la biblioteca');

    const original = await imagenEnElBaul(world, vault.library.id);
    const copied = await world.copyFromVault.execute(ana, created.value.id, [original.itemId]);

    if (!copied.ok) throw new Error('no se copió');

    const copia = copied.value[0];

    if (!copia) throw new Error('no se copió');

    await world.removeItem.execute(ana, created.value.id, copia.id);

    expect(world.storage.objects.has(original.storageKey)).toBe(true);
  });

  it('no deja copiar desde el baúl de otra cuenta', async () => {
    const world = buildLibraries();
    const vaultDeAna = await world.openVault.execute(ana);
    const original = await imagenEnElBaul(world, vaultDeAna.library.id);

    await world.openVault.execute(beto);
    const deBeto = await world.create.execute(beto, { name: 'Lo mío' });

    if (!deBeto.ok) throw new Error('no se creó la biblioteca');

    const copied = await world.copyFromVault.execute(beto, deBeto.value.id, [original.itemId]);

    expect(copied.ok).toBe(false);
    expect(await world.items.listOf(deBeto.value.id)).toHaveLength(0);
  });

  it('copia un texto sin tocar el almacenamiento', async () => {
    const world = buildLibraries();
    const vault = await world.openVault.execute(ana);
    const created = await world.create.execute(ana, { name: 'Cosas' });

    if (!created.ok) throw new Error('no se creó la biblioteca');

    const text = await world.addText.execute(ana, vault.library.id, 'Buenos días');

    if (!text.ok) throw new Error('no se agregó el texto');

    const copied = await world.copyFromVault.execute(ana, created.value.id, [text.value.id]);

    expect(copied.ok).toBe(true);
    if (!copied.ok) return;

    expect(copied.value[0]?.textContent).toBe('Buenos días');
    expect(copied.value[0]?.storageKey).toBeNull();
    expect(world.storage.objects.size).toBe(0);
  });

  /*
   * El reclamo del cliente, literal: «debe existir una opción en la que pueda
   * seleccionar varios … y puedan subirse todos de un solo y no uno por uno».
   */
  it('trae varios de una vez y cada uno cae en su propio sitio', async () => {
    const world = buildLibraries();
    const vault = await world.openVault.execute(ana);
    const created = await world.create.execute(ana, { name: 'Cosas' });

    if (!created.ok) throw new Error('no se creó la biblioteca');

    const una = await imagenEnElBaul(world, vault.library.id);
    const otra = await imagenEnElBaul(world, vault.library.id);
    const texto = await world.addText.execute(ana, vault.library.id, 'Buenos días');

    if (!texto.ok) throw new Error('no se agregó el texto');

    const copied = await world.copyFromVault.execute(ana, created.value.id, [
      una.itemId,
      otra.itemId,
      texto.value.id,
    ]);

    expect(copied.ok).toBe(true);
    if (!copied.ok) return;

    expect(copied.value).toHaveLength(3);
    expect(await world.items.listOf(created.value.id)).toHaveLength(3);

    // Las dos imágenes van una detrás de la otra, no encima: sin llevar la
    // cuenta de la última posición, las dos caerían en el mismo número.
    const imagenes = copied.value.filter((item) => item.kind === 'IMAGE');

    expect(imagenes).toHaveLength(2);
    expect(imagenes[0]?.position).not.toBe(imagenes[1]?.position);

    // Cada copia con su propio archivo, y los originales intactos.
    expect(world.storage.objects.has(una.storageKey)).toBe(true);
    expect(world.storage.objects.has(otra.storageKey)).toBe(true);
    expect(world.storage.objects.size).toBe(4);
  });

  /*
   * Comprobar todo antes de copiar nada. Copiando mientras se recorre, el
   * elemento malo de la posición tres dejaría dos copias hechas y un error en
   * la pantalla, y nadie sabría qué entró.
   */
  it('si uno de la lista no existe, no entra ninguno', async () => {
    const world = buildLibraries();
    const vault = await world.openVault.execute(ana);
    const created = await world.create.execute(ana, { name: 'Cosas' });

    if (!created.ok) throw new Error('no se creó la biblioteca');

    const original = await imagenEnElBaul(world, vault.library.id);
    const inventado = LibraryItemId.from('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

    const copied = await world.copyFromVault.execute(ana, created.value.id, [
      original.itemId,
      inventado,
    ]);

    expect(copied.ok).toBe(false);
    expect(await world.items.listOf(created.value.id)).toHaveLength(0);
    // Y sin archivos sueltos en el almacenamiento: solo queda el del baúl.
    expect(world.storage.objects.size).toBe(1);
  });

  it('no deja copiar dentro del propio baúl', async () => {
    const world = buildLibraries();
    const vault = await world.openVault.execute(ana);
    const original = await imagenEnElBaul(world, vault.library.id);

    const copied = await world.copyFromVault.execute(ana, vault.library.id, [original.itemId]);

    expect(copied.ok).toBe(false);
  });
});
