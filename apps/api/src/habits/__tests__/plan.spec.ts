import { beforeEach, describe, expect, it } from 'vitest';
import {
  ANA,
  BAUL,
  build,
  DESTINATARIO,
  EJERCICIO,
  LEER,
  OTRO,
  OTRO_DESTINATARIO,
  unPlan,
  ZONA,
  type World,
} from './support';

let world: World;

beforeEach(() => {
  world = build();
});

describe('crear un plan', () => {
  it('arranca hoy y termina el día que le toca', async () => {
    const plan = (await unPlan(world, 7)).toSnapshot();

    // Siete días contando el de hoy: del 11 al 17, no al 18.
    expect(plan.startOn).toBe('2026-05-11');
    expect(plan.endOn).toBe('2026-05-17');
    expect(plan.status).toBe('ACTIVE');
  });

  it('copia el nombre de cada biblioteca, para que sobreviva a que la borren', async () => {
    const plan = (await unPlan(world)).toSnapshot();

    expect(plan.habits.map((habit) => habit.label)).toEqual(['Ejercicio', 'Leer']);
  });

  /*
   * Sin `chat_id` no hay a dónde mandar los botones ni el informe del final, así
   * que el plan nacería mudo. Se dice ahora y no cuando el informe no llegue.
   */
  it('no deja armarlo hacia alguien que no abrió su enlace', async () => {
    world.recipients.chatId = null;

    const created = await world.create.execute(
      ANA,
      { name: 'Plan', recipientId: DESTINATARIO, durationDays: 7, libraryIds: [EJERCICIO] },
      ZONA,
    );

    expect(created.ok).toBe(false);
    expect(created.ok ? '' : created.error.code).toBe('habit_plan.recipient_not_linked');
  });

  it('el baúl no puede ser un hábito', async () => {
    const created = await world.create.execute(
      ANA,
      { name: 'Plan', recipientId: DESTINATARIO, durationDays: 7, libraryIds: [BAUL] },
      ZONA,
    );

    expect(created.ok ? '' : created.error.code).toBe('habit_plan.vault_is_not_a_habit');
  });

  it('no deja meter la biblioteca de otra cuenta', async () => {
    const created = await world.create.execute(
      OTRO,
      { name: 'Plan', recipientId: DESTINATARIO, durationDays: 7, libraryIds: [EJERCICIO] },
      ZONA,
    );

    expect(created.ok).toBe(false);
  });

  it('rechaza un plazo que no es de los cuatro', async () => {
    const created = await world.create.execute(
      ANA,
      { name: 'Plan', recipientId: DESTINATARIO, durationDays: 10, libraryIds: [EJERCICIO] },
      ZONA,
    );

    expect(created.ok ? '' : created.error.code).toBe('habit_plan.invalid_duration');
  });
});

describe('una biblioteca, un plan por destinatario', () => {
  it('no deja meterla dos veces hacia la misma persona', async () => {
    await unPlan(world);

    const segundo = await world.create.execute(
      ANA,
      { name: 'Otro', recipientId: DESTINATARIO, durationDays: 7, libraryIds: [EJERCICIO] },
      ZONA,
    );

    expect(segundo.ok ? '' : segundo.error.code).toBe('habit_plan.library_already_in_plan');
    expect(segundo.ok ? '' : segundo.error.message).toContain('Ejercicio');
  });

  /*
   * «no se enviará el Quick Reply Button a menos que esté parametrizada en otro
   * plan de hábitos»: el cliente da por hecho que una biblioteca puede estar en
   * dos planes. Puede, mientras vayan a personas distintas — son horarios
   * distintos y envíos distintos, así que ninguna respuesta queda ambigua.
   */
  it('sí deja meterla en otro plan hacia otra persona', async () => {
    await unPlan(world);

    const segundo = await world.create.execute(
      ANA,
      {
        name: 'Para mamá',
        recipientId: OTRO_DESTINATARIO,
        durationDays: 7,
        libraryIds: [EJERCICIO],
      },
      ZONA,
    );

    expect(segundo.ok).toBe(true);
  });

  it('anular el primero las libera', async () => {
    const plan = await unPlan(world);

    await world.cancel.execute(ANA, plan.id);

    const segundo = await world.create.execute(
      ANA,
      { name: 'Otro', recipientId: DESTINATARIO, durationDays: 7, libraryIds: [EJERCICIO, LEER] },
      ZONA,
    );

    expect(segundo.ok).toBe(true);
  });
});

describe('un plan no se edita', () => {
  it('no se puede anular dos veces', async () => {
    const plan = await unPlan(world);

    await world.cancel.execute(ANA, plan.id);
    const otraVez = await world.cancel.execute(ANA, plan.id);

    expect(otraVez.ok ? '' : otraVez.error.code).toBe('habit_plan.not_active');
  });

  it('no se puede reenviar el informe de uno que sigue en marcha', async () => {
    const plan = await unPlan(world);

    const enviado = await world.report.execute(ANA, plan.id);

    expect(enviado.ok ? '' : enviado.error.code).toBe('habit_plan.not_closed');
  });
});

describe('cada quien ve lo suyo', () => {
  it('el plan de otra cuenta no existe, en vez de estar prohibido', async () => {
    const plan = await unPlan(world);

    const ajeno = await world.read.detail(OTRO, plan.id);

    expect(ajeno.ok ? '' : ajeno.error.code).toBe('habit_plan.not_found');
    expect(ajeno.ok ? '' : ajeno.error.kind).toBe('not_found');
  });

  it('el listado solo trae los de su dueño', async () => {
    await unPlan(world);

    expect(await world.read.list(ANA)).toHaveLength(1);
    expect(await world.read.list(OTRO)).toHaveLength(0);
  });
});
