import { beforeEach, describe, expect, it } from 'vitest';
import { build, EJERCICIO, unEnvio, unPlan, type World } from './support';

let world: World;

beforeEach(() => {
  world = build();
});

/*
 * El calendario de mentira corta el día a medianoche UTC, así que acá las
 * horas de los avisos (8, 14 y 20) son horas UTC. El plan nace a las 16:00.
 */
describe('avisos de progreso', () => {
  it('no manda el de antes de crear el plan, y sí el siguiente', async () => {
    const plan = await unPlan(world, 7, 3);

    expect(await world.progress.execute()).toEqual([]);

    unEnvio(world, plan, {
      deliveryId: 'envio-1',
      libraryId: EJERCICIO,
      at: new Date('2026-05-11T17:00:00.000Z'),
    });
    await world.vote.cast({ deliveryId: 'envio-1', chatId: '555', answer: 'DONE' });
    world.clock.set(new Date('2026-05-11T20:05:00.000Z'));

    expect(await world.progress.execute()).toHaveLength(1);
    expect(world.notifier.sent.at(-1)?.text).toBe(
      [
        'Avance plan «Yo en 30 días»',
        'En este momento tu avance es:',
        '',
        'Ejercicio: 100% (1 notificación · 1 respuesta)',
        'Leer: sin envíos todavía',
      ].join('\n'),
    );
  });

  it('no repite el mismo aviso en la vuelta siguiente', async () => {
    await unPlan(world, 7, 3);
    world.clock.set(new Date('2026-05-11T20:05:00.000Z'));

    await world.progress.execute();
    await world.progress.execute();

    expect(world.notifier.sent).toHaveLength(1);
  });

  it('un plan sin avisos no manda nada', async () => {
    await unPlan(world);
    world.clock.set(new Date('2026-05-11T20:05:00.000Z'));

    expect(await world.progress.execute()).toEqual([]);
  });

  it('pasado el último día no avisa, aunque el plan siga sin cerrar', async () => {
    await unPlan(world, 7, 3);
    world.clock.set(new Date('2026-05-18T20:05:00.000Z'));

    expect(await world.progress.execute()).toEqual([]);
  });

  it('un plan anulado deja de avisar', async () => {
    const plan = await unPlan(world, 7, 3);
    await world.cancel.execute(plan.ownerId, plan.id);
    world.clock.set(new Date('2026-05-11T20:05:00.000Z'));

    expect(await world.progress.execute()).toEqual([]);
  });
});
