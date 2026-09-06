import { beforeEach, describe, expect, it } from 'vitest';
import { CALLBACK_DATA_MAX_BYTES, habitActions, parseHabitAction } from '../../shared/habit-vote';
import { ANA, AHORA, build, EJERCICIO, unEnvio, unPlan, type World } from './support';

let world: World;

beforeEach(() => {
  world = build();
});

describe('el dato que viaja en el botón', () => {
  const ENVIO = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

  it('cabe en los bytes que admite Telegram', () => {
    for (const action of habitActions(ENVIO)) {
      expect(Buffer.byteLength(action.data, 'utf8')).toBeLessThanOrEqual(CALLBACK_DATA_MAX_BYTES);
    }
  });

  it('va y vuelve sin perder nada', () => {
    const [realizado, medias, noCumplido] = habitActions(ENVIO);

    expect(parseHabitAction(realizado?.data ?? '')).toEqual({
      deliveryId: ENVIO,
      answer: 'DONE',
    });
    expect(parseHabitAction(medias?.data ?? '')?.answer).toBe('HALF');
    expect(parseHabitAction(noCumplido?.data ?? '')?.answer).toBe('MISSED');
  });

  /*
   * El botón que queda tras votar lleva `h:` pelado. Tiene que rechazarse acá:
   * es lo que hace que volver a tocarlo no anote nada.
   */
  it('rechaza la basura y el botón ya usado', () => {
    expect(parseHabitAction('h:')).toBeNull();
    expect(parseHabitAction('')).toBeNull();
    expect(parseHabitAction(`h:${ENVIO}:X`)).toBeNull();
    expect(parseHabitAction(`otro:${ENVIO}:D`)).toBeNull();
    expect(parseHabitAction('h:no-es-un-uuid:D')).toBeNull();
  });
});

describe('votar', () => {
  it('anota la respuesta que llega del chat correcto', async () => {
    const plan = await unPlan(world);

    unEnvio(world, plan, { deliveryId: 'envio-1', libraryId: EJERCICIO, at: AHORA });

    const resultado = await world.vote.cast({
      deliveryId: 'envio-1',
      chatId: '555',
      answer: 'DONE',
    });

    expect(resultado).toBe('RECORDED');
    expect(world.responses.rows.get('envio-1')?.answer).toBe('DONE');
  });

  /*
   * «Una vez realizada la votación no será posible cambiar dicha acción.» Lo
   * decide la clave primaria de la tabla, no una consulta previa: dos toques a
   * la vez podrían pasar los dos.
   */
  it('el segundo toque no cambia nada', async () => {
    const plan = await unPlan(world);

    unEnvio(world, plan, { deliveryId: 'envio-1', libraryId: EJERCICIO, at: AHORA });

    await world.vote.cast({ deliveryId: 'envio-1', chatId: '555', answer: 'DONE' });
    const otraVez = await world.vote.cast({
      deliveryId: 'envio-1',
      chatId: '555',
      answer: 'MISSED',
    });

    expect(otraVez).toBe('ALREADY');
    expect(world.responses.rows.get('envio-1')?.answer).toBe('DONE');
  });

  /*
   * El `callback_data` viaja por un canal público. El chat es la única prueba de
   * quién está votando, porque el bot no tiene sesión.
   */
  it('un chat ajeno no puede votar, y no se le dice por qué', async () => {
    const plan = await unPlan(world);

    unEnvio(world, plan, { deliveryId: 'envio-1', libraryId: EJERCICIO, at: AHORA });

    const resultado = await world.vote.cast({
      deliveryId: 'envio-1',
      chatId: '999',
      answer: 'DONE',
    });

    expect(resultado).toBe('IGNORED');
    expect(world.responses.rows.size).toBe(0);
  });

  it('un envío que no es de ningún plan se ignora', async () => {
    const resultado = await world.vote.cast({
      deliveryId: 'envio-inventado',
      chatId: '555',
      answer: 'DONE',
    });

    expect(resultado).toBe('IGNORED');
  });

  it('un día ya cerrado no admite más respuestas', async () => {
    const plan = await unPlan(world);

    unEnvio(world, plan, { deliveryId: 'envio-1', libraryId: EJERCICIO, at: AHORA });
    plan.markScored('2026-05-11');

    const resultado = await world.vote.cast({
      deliveryId: 'envio-1',
      chatId: '555',
      answer: 'DONE',
    });

    expect(resultado).toBe('CLOSED');
    expect(world.responses.rows.size).toBe(0);
  });

  it('un plan anulado deja de contar los toques que le quedan en el chat', async () => {
    const plan = await unPlan(world);

    unEnvio(world, plan, { deliveryId: 'envio-1', libraryId: EJERCICIO, at: AHORA });
    await world.cancel.execute(ANA, plan.id);

    const resultado = await world.vote.cast({
      deliveryId: 'envio-1',
      chatId: '555',
      answer: 'DONE',
    });

    expect(resultado).toBe('IGNORED');
  });
});
