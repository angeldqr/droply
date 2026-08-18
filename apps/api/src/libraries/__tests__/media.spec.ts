import { describe, expect, it } from 'vitest';
import type { LibraryId, LibraryItemId } from '../../shared/identifiers';
import { MEDIA_LIMITS, type MediaKind } from '../domain/media-limits';
import { ana, beto, buildLibraries } from './support';

/** Cabeceras de verdad de cada formato, que es justo lo que se va a verificar. */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const MP3 = new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00]);

type World = ReturnType<typeof buildLibraries>;

async function anaConBiblioteca(): Promise<{ world: World; libraryId: LibraryId }> {
  const world = buildLibraries();
  const created = await world.create.execute(ana, { name: 'Cosas' });

  if (!created.ok) throw new Error('no se pudo crear la biblioteca');

  return { world, libraryId: created.value.id };
}

/** Pide el permiso, deja los bytes indicados donde los dejaría el navegador, confirma. */
async function subir(
  world: World,
  libraryId: LibraryId,
  request: { kind: MediaKind; fileName: string; mimeType: string; sizeBytes: number },
  bytes: Uint8Array | null,
) {
  const started = await world.requestUpload.execute(ana, libraryId, request);

  if (!started.ok) throw new Error('no se pudo firmar el permiso');

  const { id, storageKey } = started.value.item;

  if (bytes && storageKey) world.storage.put(storageKey, bytes);

  return {
    itemId: id,
    storageKey: storageKey ?? '',
    confirmed: await world.confirmUpload.execute(ana, libraryId, id),
  };
}

describe('subida de archivos a una biblioteca', () => {
  it('rechaza un tipo que no sirve para esa columna', async () => {
    const { world, libraryId } = await anaConBiblioteca();

    const started = await world.requestUpload.execute(ana, libraryId, {
      kind: 'IMAGE',
      fileName: 'trampa.png',
      mimeType: 'audio/mpeg',
      sizeBytes: 1024,
    });

    expect(started.ok).toBe(false);
    // Ni elemento a medias ni permiso firmado.
    expect(world.items.rows.size).toBe(0);
    expect(world.storage.tickets.size).toBe(0);
  });

  it('rechaza un tamaño declarado por encima del techo', async () => {
    const { world, libraryId } = await anaConBiblioteca();

    const started = await world.requestUpload.execute(ana, libraryId, {
      kind: 'IMAGE',
      fileName: 'gato.png',
      mimeType: 'image/png',
      sizeBytes: MEDIA_LIMITS.IMAGE.maxBytes + 1,
    });

    expect(started.ok).toBe(false);
    expect(world.items.rows.size).toBe(0);
  });

  it('firma el permiso con el techo de la columna, no con el tamaño declarado', async () => {
    const { world, libraryId } = await anaConBiblioteca();

    const started = await world.requestUpload.execute(ana, libraryId, {
      kind: 'IMAGE',
      fileName: 'gato.png',
      mimeType: 'image/png',
      sizeBytes: 10,
    });

    if (!started.ok) throw new Error('debería haber firmado');

    // Si se firmara con los 10 bytes declarados, un archivo legítimo un poco
    // más grande se caería contra el almacenamiento sin explicación.
    const ticket = world.storage.tickets.get(started.value.item.storageKey ?? '');

    expect(ticket?.maxBytes).toBe(MEDIA_LIMITS.IMAGE.maxBytes);
    expect(ticket?.mimeType).toBe('image/png');
  });

  it('deja el elemento pendiente y sin URL hasta que se confirma', async () => {
    const { world, libraryId } = await anaConBiblioteca();

    const started = await world.requestUpload.execute(ana, libraryId, {
      kind: 'IMAGE',
      fileName: 'gato.png',
      mimeType: 'image/png',
      sizeBytes: PNG.length,
    });

    if (!started.ok) throw new Error('debería haber firmado');

    expect(started.value.item.isReady).toBe(false);

    const found = await world.get.execute(ana, libraryId);

    if (!found.ok) throw new Error('la biblioteca debería estar');
    expect(found.value.mediaLinks.size).toBe(0);
  });

  it('acepta un archivo que es lo que dijo ser', async () => {
    const { world, libraryId } = await anaConBiblioteca();

    const { confirmed, itemId } = await subir(
      world,
      libraryId,
      { kind: 'IMAGE', fileName: 'gato.png', mimeType: 'image/png', sizeBytes: PNG.length },
      PNG,
    );

    expect(confirmed.ok).toBe(true);

    const found = await world.get.execute(ana, libraryId);

    if (!found.ok) throw new Error('la biblioteca debería estar');
    expect(found.value.mediaLinks.get(itemId)).toContain('firma=x');
  });

  it('borra el objeto y la fila si los bytes no son del tipo declarado', async () => {
    const { world, libraryId } = await anaConBiblioteca();

    // Un MP3 al que le cambiaron la extensión: el navegador lo declara PNG.
    const { confirmed, storageKey } = await subir(
      world,
      libraryId,
      { kind: 'IMAGE', fileName: 'gato.png', mimeType: 'image/png', sizeBytes: MP3.length },
      MP3,
    );

    if (confirmed.ok) throw new Error('no debería haber pasado la verificación');
    expect(confirmed.error.code).toBe('item.media_type_mismatch');

    expect(world.items.rows.size).toBe(0);
    expect(world.storage.objects.has(storageKey)).toBe(false);
  });

  it('borra el objeto y la fila si el archivo que llegó pasa el techo', async () => {
    const { world, libraryId } = await anaConBiblioteca();

    // El almacenamiento debería cortarlo antes de escribir, pero el caso de uso
    // no se apoya en que alguien más haya validado.
    const enorme = new Uint8Array(MEDIA_LIMITS.IMAGE.maxBytes + 1);
    enorme.set(PNG, 0);

    const { confirmed, storageKey } = await subir(
      world,
      libraryId,
      { kind: 'IMAGE', fileName: 'gato.png', mimeType: 'image/png', sizeBytes: PNG.length },
      enorme,
    );

    if (confirmed.ok) throw new Error('no debería haber pasado la verificación');
    expect(confirmed.error.code).toBe('item.media_too_large');

    expect(world.items.rows.size).toBe(0);
    expect(world.storage.objects.has(storageKey)).toBe(false);
  });

  it('avisa si se confirma algo que nunca se subió, y deja el elemento en pie', async () => {
    const { world, libraryId } = await anaConBiblioteca();

    const { confirmed } = await subir(
      world,
      libraryId,
      { kind: 'AUDIO', fileName: 'saludo.mp3', mimeType: 'audio/mpeg', sizeBytes: MP3.length },
      null,
    );

    if (confirmed.ok) throw new Error('no debería haber pasado la verificación');
    expect(confirmed.error.code).toBe('item.media_not_uploaded');

    // Sigue pendiente: el navegador puede reintentar la subida.
    expect(world.items.rows.size).toBe(1);
  });

  it('confirmar dos veces devuelve lo mismo', async () => {
    const { world, libraryId } = await anaConBiblioteca();

    const { itemId } = await subir(
      world,
      libraryId,
      { kind: 'AUDIO', fileName: 'saludo.mp3', mimeType: 'audio/mpeg', sizeBytes: MP3.length },
      MP3,
    );

    const otraVez = await world.confirmUpload.execute(ana, libraryId, itemId);

    expect(otraVez.ok).toBe(true);
    expect(world.items.rows.size).toBe(1);
  });

  it('no deja confirmar un elemento de texto', async () => {
    const { world, libraryId } = await anaConBiblioteca();
    const texto = await world.addText.execute(ana, libraryId, 'Hola');

    if (!texto.ok) throw new Error('el texto debería haberse creado');

    const confirmed = await world.confirmUpload.execute(ana, libraryId, texto.value.id);

    expect(confirmed.ok).toBe(false);
  });

  it('quitar un elemento borra su archivo', async () => {
    const { world, libraryId } = await anaConBiblioteca();

    const { itemId, storageKey } = await subir(
      world,
      libraryId,
      { kind: 'IMAGE', fileName: 'gato.png', mimeType: 'image/png', sizeBytes: PNG.length },
      PNG,
    );

    await world.removeItem.execute(ana, libraryId, itemId);

    expect(world.storage.objects.has(storageKey)).toBe(false);
  });

  it('borrar la biblioteca borra los archivos de todos sus elementos', async () => {
    const { world, libraryId } = await anaConBiblioteca();

    await subir(
      world,
      libraryId,
      { kind: 'IMAGE', fileName: 'gato.png', mimeType: 'image/png', sizeBytes: PNG.length },
      PNG,
    );
    await subir(
      world,
      libraryId,
      { kind: 'AUDIO', fileName: 'saludo.mp3', mimeType: 'audio/mpeg', sizeBytes: MP3.length },
      MP3,
    );

    expect(world.storage.objects.size).toBe(2);

    await world.remove.execute(ana, libraryId);

    expect(world.storage.objects.size).toBe(0);
  });

  it('no deja subir a la biblioteca de otro', async () => {
    const { world, libraryId } = await anaConBiblioteca();

    const started = await world.requestUpload.execute(beto, libraryId, {
      kind: 'IMAGE',
      fileName: 'gato.png',
      mimeType: 'image/png',
      sizeBytes: PNG.length,
    });

    expect(started.ok).toBe(false);
    expect(world.storage.tickets.size).toBe(0);
  });

  it('un elemento de media ajeno responde igual que uno inexistente', async () => {
    const { world, libraryId } = await anaConBiblioteca();

    const { itemId } = await subir(
      world,
      libraryId,
      { kind: 'IMAGE', fileName: 'gato.png', mimeType: 'image/png', sizeBytes: PNG.length },
      PNG,
    );

    const ajeno = await world.confirmUpload.execute(beto, libraryId, itemId);
    const inventado = await world.confirmUpload.execute(
      beto,
      libraryId,
      '00000000-0000-4000-8000-00000000ffff' as LibraryItemId,
    );

    if (ajeno.ok || inventado.ok) throw new Error('ninguno de los dos debería pasar');

    // Si difirieran, probar identificadores diría cuáles existen.
    expect(ajeno.error.code).toBe(inventado.error.code);
    expect(ajeno.error.message).toBe(inventado.error.message);
  });
});
