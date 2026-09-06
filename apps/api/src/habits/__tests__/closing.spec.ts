import { beforeEach, describe, expect, it } from 'vitest';
import { ANA, build, EJERCICIO, LEER, unEnvio, unPlan, type World } from './support';

let world: World;

beforeEach(() => {
  world = build();
});

/**
 * La tarde de un día del plan, en UTC.
 *
 * Después de las cuatro a propósito: el plan se crea a las 16:00 y un envío
 * anterior a su creación no cuenta —salió sin botones, así que nadie pudo
 * responderlo—. Es la regla que prueba «no cuenta lo que salió antes del plan».
 */
function porLaTarde(day: string): Date {
  return new Date(`${day}T18:00:00.000Z`);
}

/** La mañana, que el día que arranca el plan queda antes de que exista. */
function porLaManana(day: string): Date {
  return new Date(`${day}T12:00:00.000Z`);
}

/** Adelanta el reloj a ese día. */
function elDiaEs(day: string): void {
  world.clock.set(porLaTarde(day));
}

describe('cerrar un día', () => {
  it('no cierra el día que todavía corre', async () => {
    await unPlan(world);

    expect(await world.close.execute()).toEqual([]);
  });

  it('cuenta lo que salió y lo que se respondió', async () => {
    const plan = await unPlan(world);

    // Dos de ejercicio, uno respondido; uno de leer, respondido a medias.
    unEnvio(world, plan, { deliveryId: 'e1', libraryId: EJERCICIO, at: porLaTarde('2026-05-11') });
    unEnvio(world, plan, { deliveryId: 'e2', libraryId: EJERCICIO, at: porLaTarde('2026-05-11') });
    unEnvio(world, plan, { deliveryId: 'l1', libraryId: LEER, at: porLaTarde('2026-05-11') });

    await world.vote.cast({ deliveryId: 'e1', chatId: '555', answer: 'DONE' });
    await world.vote.cast({ deliveryId: 'l1', chatId: '555', answer: 'HALF' });

    elDiaEs('2026-05-12');
    await world.close.execute();

    const dias = world.plans.days.get(plan.id) ?? [];

    expect(dias).toEqual([
      { libraryId: EJERCICIO, day: '2026-05-11', sent: 2, answered: 1, earned: 1 },
      { libraryId: LEER, day: '2026-05-11', sent: 1, answered: 1, earned: 0.5 },
    ]);
  });

  it('manda el resumen con los porcentajes del día', async () => {
    const plan = await unPlan(world);

    unEnvio(world, plan, { deliveryId: 'e1', libraryId: EJERCICIO, at: porLaTarde('2026-05-11') });
    await world.vote.cast({ deliveryId: 'e1', chatId: '555', answer: 'DONE' });

    elDiaEs('2026-05-12');
    await world.close.execute();

    const [aviso] = world.notifier.sent;

    expect(aviso?.chatId).toBe('555');
    expect(aviso?.text).toContain('día 1 de 7');
    expect(aviso?.text).toContain('Ejercicio: 100%');
    // «Leer» no salió ese día, así que no se nombra: decir «sin envíos» tres
    // veces por semana entrena a la gente a no leer el mensaje.
    expect(aviso?.text).not.toContain('Leer');
  });

  /*
   * Un plan creado a media mañana no puede cargar con los envíos que ya habían
   * salido esa madrugada: salieron sin botones, porque entonces la biblioteca
   * todavía no era un hábito. Contándolos, el día 1 nacía castigado.
   */
  it('no cuenta lo que salió antes de existir el plan', async () => {
    const plan = await unPlan(world);

    unEnvio(world, plan, {
      deliveryId: 'antes',
      libraryId: EJERCICIO,
      at: porLaManana('2026-05-11'),
    });
    unEnvio(world, plan, {
      deliveryId: 'despues',
      libraryId: EJERCICIO,
      at: porLaTarde('2026-05-11'),
    });
    await world.vote.cast({ deliveryId: 'despues', chatId: '555', answer: 'DONE' });

    elDiaEs('2026-05-12');
    await world.close.execute();

    const ejercicio = (world.plans.days.get(plan.id) ?? []).find(
      (dia) => dia.libraryId === EJERCICIO,
    );

    // Uno solo salió con botones, y se respondió: cien por ciento, no cincuenta.
    expect(ejercicio).toMatchObject({ sent: 1, answered: 1, earned: 1 });
  });

  it('no cuenta lo que salió otro día', async () => {
    const plan = await unPlan(world);

    unEnvio(world, plan, { deliveryId: 'e1', libraryId: EJERCICIO, at: porLaTarde('2026-05-12') });

    elDiaEs('2026-05-12');
    await world.close.execute();

    const dias = world.plans.days.get(plan.id) ?? [];

    expect(dias.every((dia) => dia.sent === 0)).toBe(true);
  });

  /*
   * Si el proceso estuvo caído tres días, se recuperan los tres, cada uno con
   * su resumen y en orden. Saltárselos dejaría huecos en la rejilla que nadie
   * podría explicar después.
   */
  it('se pone al día de a un día por vuelta', async () => {
    const plan = await unPlan(world);

    elDiaEs('2026-05-14');

    expect(await world.close.execute()).toEqual([`${plan.id}:2026-05-11`]);
    expect(await world.close.execute()).toEqual([`${plan.id}:2026-05-12`]);
    expect(await world.close.execute()).toEqual([`${plan.id}:2026-05-13`]);
    expect(await world.close.execute()).toEqual([]);
  });
});

describe('cerrar el plan', () => {
  it('al pasar el último día lo termina y manda el informe una sola vez', async () => {
    const plan = await unPlan(world, 7);

    unEnvio(world, plan, { deliveryId: 'e1', libraryId: EJERCICIO, at: porLaTarde('2026-05-11') });
    await world.vote.cast({ deliveryId: 'e1', chatId: '555', answer: 'DONE' });

    // Del 11 al 17: hay que cerrar los siete días.
    elDiaEs('2026-05-18');

    for (let vuelta = 0; vuelta < 8; vuelta += 1) await world.close.execute();

    expect(plan.status).toBe('CLOSED');
    expect(plan.toSnapshot().reportSentAt).not.toBeNull();

    const informes = world.notifier.sent.filter((aviso) => aviso.text.startsWith('Terminó'));

    expect(informes).toHaveLength(1);
    expect(informes[0]?.text).toContain('Ejercicio: 100%');
    expect(informes[0]?.text).toContain('Total del plan');
  });

  it('un plan terminado deja reenviar el informe, y nada más', async () => {
    const plan = await unPlan(world, 7);

    elDiaEs('2026-05-18');
    for (let vuelta = 0; vuelta < 8; vuelta += 1) await world.close.execute();

    world.notifier.sent.length = 0;

    const reenviado = await world.report.execute(ANA, plan.id);

    expect(reenviado.ok).toBe(true);
    expect(world.notifier.sent).toHaveLength(1);

    const anular = await world.cancel.execute(ANA, plan.id);

    expect(anular.ok ? '' : anular.error.code).toBe('habit_plan.not_active');
  });

  it('un plan anulado deja de cerrar días', async () => {
    const plan = await unPlan(world);

    await world.cancel.execute(ANA, plan.id);
    elDiaEs('2026-05-14');

    expect(await world.close.execute()).toEqual([]);
  });

  /*
   * El latido solo atiende planes vivos, así que sin esto el día en el que
   * alguien anula quedaba vacío para siempre: quien anulara a las once de la
   * noche perdía el día entero de un plumazo.
   */
  it('anular deja cerrado el día en curso', async () => {
    const plan = await unPlan(world);

    unEnvio(world, plan, {
      deliveryId: 'e1',
      libraryId: EJERCICIO,
      at: porLaTarde('2026-05-11'),
    });
    await world.vote.cast({ deliveryId: 'e1', chatId: '555', answer: 'DONE' });

    await world.cancel.execute(ANA, plan.id);

    const hoy = (world.plans.days.get(plan.id) ?? []).find((dia) => dia.day === '2026-05-11');

    expect(hoy).toMatchObject({ libraryId: EJERCICIO, sent: 1, earned: 1 });
    expect(plan.status).toBe('CANCELLED');
  });
});

describe('el informe que no sale', () => {
  /*
   * El notificador se traga los fallos para no tumbar el latido. Sellar sin
   * mirar dejaría al dueño viendo una fecha de envío que nunca ocurrió, y sin
   * pista de que tiene que reenviarlo.
   */
  it('no se sella como enviado', async () => {
    const plan = await unPlan(world, 7);

    world.notifier.entrega = false;
    elDiaEs('2026-05-18');
    for (let vuelta = 0; vuelta < 8; vuelta += 1) await world.close.execute();

    expect(plan.status).toBe('CLOSED');
    expect(plan.toSnapshot().reportSentAt).toBeNull();
  });

  it('y el reenvío a mano lo dice en vez de callarse', async () => {
    const plan = await unPlan(world, 7);

    elDiaEs('2026-05-18');
    for (let vuelta = 0; vuelta < 8; vuelta += 1) await world.close.execute();

    world.notifier.entrega = false;
    const reenviado = await world.report.execute(ANA, plan.id);

    expect(reenviado.ok).toBe(false);
  });
});

describe('dos réplicas cerrando el mismo día', () => {
  /*
   * La escritura es condicional: la segunda no encuentra el plan donde lo
   * dejó y no escribe nada, así que el resumen sale una sola vez.
   */
  it('solo una escribe, y solo una avisa', async () => {
    const plan = await unPlan(world);

    elDiaEs('2026-05-12');

    const primera = await world.plans.commitDay({
      planId: plan.id,
      previous: null,
      day: '2026-05-11',
      rows: [],
    });
    const segunda = await world.plans.commitDay({
      planId: plan.id,
      previous: null,
      day: '2026-05-11',
      rows: [],
    });

    expect(primera).toBe(true);
    expect(segunda).toBe(false);
  });
});
