import { describe, expect, it } from 'vitest';
import type { LibraryId, LibraryItemId } from '../../shared/identifiers';
import { needsRebalance, rebalanced } from '../domain/position';
import { ana, buildLibraries } from './support';

/**
 * El orden de una columna es lo que el usuario ve y arrastra. Las posiciones
 * son fraccionarias para que mover un elemento escriba una sola fila.
 */
async function columnaCon(textos: string[]) {
  const world = buildLibraries();
  const created = await world.create.execute(ana, { name: 'Frases' });
  if (!created.ok) throw new Error('no se pudo crear');

  const ids: LibraryItemId[] = [];
  for (const texto of textos) {
    const item = await world.addText.execute(ana, created.value.id, texto);
    if (!item.ok) throw new Error('no se pudo agregar');
    ids.push(item.value.id);
  }

  return { world, libraryId: created.value.id, ids };
}

function textosDe(world: ReturnType<typeof buildLibraries>, libraryId: LibraryId): string[] {
  return world.items.columnOf(libraryId, 'TEXT').map((item) => item.textContent ?? '');
}

describe('orden de una columna', () => {
  it('los elementos nuevos se apilan al final, debajo del botón de agregar', async () => {
    const { world, libraryId } = await columnaCon(['uno', 'dos', 'tres']);

    expect(textosDe(world, libraryId)).toEqual(['uno', 'dos', 'tres']);
  });

  it('mueve un elemento entre dos vecinos', async () => {
    const { world, libraryId, ids } = await columnaCon(['uno', 'dos', 'tres']);

    // "tres" pasa a quedar entre "uno" y "dos".
    const result = await world.move.execute(ana, libraryId, ids[2]!, {
      afterItemId: ids[0],
      beforeItemId: ids[1],
    });

    expect(result.ok).toBe(true);
    expect(textosDe(world, libraryId)).toEqual(['uno', 'tres', 'dos']);
  });

  it('mueve un elemento al principio', async () => {
    const { world, libraryId, ids } = await columnaCon(['uno', 'dos', 'tres']);

    await world.move.execute(ana, libraryId, ids[2]!, { beforeItemId: ids[0] });

    expect(textosDe(world, libraryId)).toEqual(['tres', 'uno', 'dos']);
  });

  it('mueve un elemento al final', async () => {
    const { world, libraryId, ids } = await columnaCon(['uno', 'dos', 'tres']);

    await world.move.execute(ana, libraryId, ids[0]!, { afterItemId: ids[2] });

    expect(textosDe(world, libraryId)).toEqual(['dos', 'tres', 'uno']);
  });

  it('mover escribe una sola fila y no renumera la columna', async () => {
    const { world, libraryId, ids } = await columnaCon(['uno', 'dos', 'tres']);
    const antes = new Map(
      world.items.columnOf(libraryId, 'TEXT').map((item) => [item.id, item.position]),
    );

    await world.move.execute(ana, libraryId, ids[2]!, {
      afterItemId: ids[0],
      beforeItemId: ids[1],
    });

    const cambiados = world.items
      .columnOf(libraryId, 'TEXT')
      .filter((item) => antes.get(item.id) !== item.position);

    expect(cambiados.map((item) => item.id)).toEqual([ids[2]]);
  });

  it('sobrevive a estrechar el hueco hasta agotar la precisión', async () => {
    const { world, libraryId, ids } = await columnaCon(['uno', 'dos', 'tres']);
    const [uno, dos, tres] = ids as [LibraryItemId, LibraryItemId, LibraryItemId];

    /*
     * Se alternan los dos últimos metiéndolos siempre justo debajo de "uno".
     * Cada pasada parte el hueco a la mitad —y a diferencia de mover siempre
     * el mismo elemento entre los mismos dos vecinos, acá el hueco sí se
     * achica—, así que en unas cincuenta vueltas se agota la precisión de un
     * `double` y el rebalanceo tiene que entrar.
     */
    for (let vuelta = 0; vuelta < 60; vuelta += 1) {
      const movido = vuelta % 2 === 0 ? tres : dos;
      const quedaDebajo = vuelta % 2 === 0 ? dos : tres;

      const result = await world.move.execute(ana, libraryId, movido, {
        afterItemId: uno,
        beforeItemId: quedaDebajo,
      });

      expect(result.ok).toBe(true);
    }

    const columna = world.items.columnOf(libraryId, 'TEXT');

    // El orden sigue siendo el correcto y las tres posiciones siguen siendo
    // distinguibles entre sí, que es lo que el rebalanceo tiene que garantizar.
    expect(columna).toHaveLength(3);
    expect(columna[0]?.textContent).toBe('uno');
    expect(new Set(columna.map((item) => item.position)).size).toBe(3);
  });

  it('el rebalanceo separa las posiciones cuando dos vecinos se tocan', () => {
    // Directo sobre la aritmética: es el caso que dispara el reparto.
    expect(needsRebalance(1024, 1024 + 1e-9)).toBe(true);
    expect(needsRebalance(1024, 2048)).toBe(false);
    expect(rebalanced(3)).toEqual([1024, 2048, 3072]);
  });

  it('rechaza mover entre dos vecinos que son el mismo elemento', async () => {
    const { world, libraryId, ids } = await columnaCon(['uno', 'dos', 'tres']);

    // Con los dos vecinos iguales la distancia entre ellos es cero, así que
    // ningún reparto de posiciones la vuelve suficiente. Antes esto recursaba
    // sin fin escribiendo en la base en cada vuelta.
    const result = await world.move.execute(ana, libraryId, ids[2]!, {
      afterItemId: ids[0],
      beforeItemId: ids[0],
    });

    expect(result.ok).toBe(false);
  });

  it('rechaza mover junto a un vecino que no existe', async () => {
    const { world, libraryId, ids } = await columnaCon(['uno', 'dos']);

    const result = await world.move.execute(ana, libraryId, ids[0]!, {
      afterItemId: '00000000-0000-4000-8000-00000000eeee',
    });

    expect(result.ok).toBe(false);
    expect(textosDe(world, libraryId)).toEqual(['uno', 'dos']);
  });

  it('cuenta los elementos por columna para el listado', async () => {
    const { world, libraryId } = await columnaCon(['uno', 'dos']);

    const listado = await world.list.execute(ana);

    expect(listado[0]?.library.id).toBe(libraryId);
    expect(listado[0]?.counts).toEqual({ AUDIO: 0, VIDEO: 0, IMAGE: 0, TEXT: 2 });
  });
});

describe('elementos de texto', () => {
  it('recorta el texto y rechaza el que queda vacío', async () => {
    const world = buildLibraries();
    const created = await world.create.execute(ana, { name: 'Frases' });
    if (!created.ok) throw new Error('no se pudo crear');

    const conEspacios = await world.addText.execute(ana, created.value.id, '  hola  ');
    const soloEspacios = await world.addText.execute(ana, created.value.id, '     ');

    expect(conEspacios.ok).toBe(true);
    if (conEspacios.ok) expect(conEspacios.value.textContent).toBe('hola');
    expect(soloEspacios.ok).toBe(false);
  });

  it('rechaza un texto más largo de lo que Telegram acepta en un mensaje', async () => {
    const world = buildLibraries();
    const created = await world.create.execute(ana, { name: 'Frases' });
    if (!created.ok) throw new Error('no se pudo crear');

    const result = await world.addText.execute(ana, created.value.id, 'a'.repeat(4097));

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe('item.text_too_long');
  });

  it('agregar un elemento marca la biblioteca como tocada', async () => {
    const world = buildLibraries();
    const created = await world.create.execute(ana, { name: 'Frases' });
    if (!created.ok) throw new Error('no se pudo crear');

    const original = created.value.updatedAt.getTime();
    world.clock.advanceBy(60_000);
    await world.addText.execute(ana, created.value.id, 'hola');

    expect(world.libraries.rows.get(created.value.id)!.updatedAt.getTime()).toBeGreaterThan(
      original,
    );
  });
});
