import { describe, expect, it } from 'vitest';
import type { LibraryId, UserId } from '../../shared/identifiers';
import {
  ListLibraryRecipients,
  SetLibraryRecipients,
} from '../application/library-recipient-use-cases';
import type { LibraryRecipientRepository, LinkedRecipients, SchedulePruner } from '../domain/ports';
import { ana, beto, buildLibraries } from './support';

const MAMA = '00000000-0000-4000-8000-0000000ma000'.replace('ma', 'aa');
const PAPA = '00000000-0000-4000-8000-0000000pa000'.replace('pa', 'bb');

class InMemoryMembers implements LibraryRecipientRepository {
  readonly rows = new Map<string, string[]>();

  idsOf(libraryId: LibraryId): Promise<string[]> {
    return Promise.resolve(this.rows.get(libraryId) ?? []);
  }

  replace(libraryId: LibraryId, recipientIds: readonly string[]): Promise<void> {
    this.rows.set(libraryId, [...recipientIds]);

    return Promise.resolve();
  }
}

/** Solo Ana tiene destinatarios vinculados; Beto no tiene ninguno. */
class FakeLinked implements LinkedRecipients {
  idsOf(ownerId: UserId): Promise<string[]> {
    return Promise.resolve(ownerId === ana ? [MAMA, PAPA] : []);
  }
}

/** Anota qué pares dejaron de valer, para poder comprobar el corte. */
class FakePruner implements SchedulePruner {
  readonly pruned: { libraryId: string; kept: string[] }[] = [];

  dropOutside(libraryId: LibraryId, recipientIds: readonly string[]): Promise<number> {
    this.pruned.push({ libraryId, kept: [...recipientIds] });

    return Promise.resolve(0);
  }
}

async function build() {
  const world = buildLibraries();
  const members = new InMemoryMembers();
  const pruner = new FakePruner();
  const created = await world.create.execute(ana, { name: 'Fotos' });

  if (!created.ok) throw new Error('no se creó la biblioteca');

  return {
    world,
    members,
    libraryId: created.value.id,
    list: new ListLibraryRecipients(world.libraries, members),
    pruner,
    set: new SetLibraryRecipients(world.libraries, members, new FakeLinked(), pruner),
  };
}

describe('destinatarios de una biblioteca', () => {
  it('nace sin destinatarios: no se le manda a nadie hasta que se elija', async () => {
    const { list, libraryId } = await build();

    const listed = await list.execute(ana, libraryId);

    expect(listed.ok).toBe(true);
    if (listed.ok) expect(listed.value).toEqual([]);
  });

  it('guarda la lista y la devuelve', async () => {
    const { set, list, libraryId } = await build();

    expect((await set.execute(ana, libraryId, [MAMA])).ok).toBe(true);

    const listed = await list.execute(ana, libraryId);

    expect(listed.ok && listed.value).toEqual([MAMA]);
  });

  it('reemplaza la lista entera en vez de acumular', async () => {
    const { set, list, libraryId } = await build();

    await set.execute(ana, libraryId, [MAMA, PAPA]);
    await set.execute(ana, libraryId, [PAPA]);

    const listed = await list.execute(ana, libraryId);

    expect(listed.ok && listed.value).toEqual([PAPA]);
  });

  it('rechaza a alguien que no es de la cuenta o no está vinculado', async () => {
    const { set, members, libraryId } = await build();

    const inventado = '00000000-0000-4000-8000-0000000000ff';

    expect((await set.execute(ana, libraryId, [inventado])).ok).toBe(false);
    // Y no toca lo que ya había.
    expect(members.rows.has(libraryId)).toBe(false);
  });

  it('el baúl no admite destinatarios: es personal', async () => {
    const { world, set } = await build();
    const vault = await world.openVault.execute(ana);

    expect((await set.execute(ana, vault.library.id, [MAMA])).ok).toBe(false);
  });

  it('la biblioteca de otra cuenta responde como inexistente', async () => {
    const { set, list, libraryId } = await build();

    expect((await set.execute(beto, libraryId, [])).ok).toBe(false);
    expect((await list.execute(beto, libraryId)).ok).toBe(false);
  });

  it('desmarcar a alguien corta los envíos que ya iban hacia esa persona', async () => {
    const { set, pruner, libraryId } = await build();

    await set.execute(ana, libraryId, [MAMA, PAPA]);
    await set.execute(ana, libraryId, [PAPA]);

    // Si no se cortaran, la casilla quedaría apagada en la pantalla pero el
    // horario le seguiría llegando a Mamá cada mañana.
    expect(pruner.pruned.at(-1)).toEqual({ libraryId, kept: [PAPA] });
  });

  it('quita duplicados antes de guardar', async () => {
    const { set, libraryId, members } = await build();

    await set.execute(ana, libraryId, [MAMA, MAMA, PAPA]);

    expect(members.rows.get(libraryId)).toEqual([MAMA, PAPA]);
  });
});
