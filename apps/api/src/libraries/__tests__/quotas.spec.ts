import { describe, expect, it } from 'vitest';
import { MAX_PER_ACCOUNT } from '../domain/library';
import { ana, beto, buildLibraries } from './support';

/**
 * Sin un tope, una cuenta puede crear filas hasta llenar el disco. No es una
 * restricción de producto —nadie ha necesitado veinte bibliotecas— sino el
 * único freno que existe entre una cuenta y la base de datos.
 */
describe('tope de bibliotecas por cuenta', () => {
  it('la que hace veinte entra y la veintiuna no', async () => {
    const world = buildLibraries();

    for (let n = 0; n < MAX_PER_ACCOUNT; n += 1) {
      expect((await world.create.execute(ana, { name: `Biblioteca ${n}` })).ok).toBe(true);
    }

    const passed = await world.create.execute(ana, { name: 'Una más' });

    expect(passed.ok).toBe(false);
    if (!passed.ok) expect(passed.error.code).toBe('library.too_many');
    expect(await world.list.execute(ana)).toHaveLength(MAX_PER_ACCOUNT);
  });

  it('el tope es por cuenta: lo de una no le ocupa sitio a la otra', async () => {
    const world = buildLibraries();

    for (let n = 0; n < MAX_PER_ACCOUNT; n += 1) {
      await world.create.execute(ana, { name: `Biblioteca ${n}` });
    }

    expect((await world.create.execute(beto, { name: 'La primera de Beto' })).ok).toBe(true);
  });
});
