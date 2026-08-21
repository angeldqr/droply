import { describe, expect, it } from 'vitest';
import { MAX_PER_ACCOUNT } from '../domain/recipient';
import { ana, buildRecipients } from './support';

/**
 * Este es el tope que de verdad importa: cada destinatario es una persona real
 * a la que el bot le va a escribir. Sin número, la aplicación es una lista de
 * difusión con otro nombre.
 */
describe('tope de destinatarios por cuenta', () => {
  it('el que hace cincuenta entra y el cincuenta y uno no', async () => {
    const world = buildRecipients();

    for (let n = 0; n < MAX_PER_ACCOUNT; n += 1) {
      expect((await world.create.execute(ana, `Persona ${n}`)).ok).toBe(true);
    }

    const passed = await world.create.execute(ana, 'Uno más');

    expect(passed.ok).toBe(false);
    if (!passed.ok) expect(passed.error.code).toBe('recipient.too_many');
    expect(await world.list.execute(ana)).toHaveLength(MAX_PER_ACCOUNT);
  });

  it('borrar uno deja sitio para otro', async () => {
    const world = buildRecipients();
    const first = await world.create.execute(ana, 'Persona 0');
    if (!first.ok) throw new Error('no se pudo crear');

    for (let n = 1; n < MAX_PER_ACCOUNT; n += 1) await world.create.execute(ana, `Persona ${n}`);

    await world.remove.execute(ana, first.value.recipient.id);

    expect((await world.create.execute(ana, 'Uno más')).ok).toBe(true);
  });
});
