import { beforeEach, describe, expect, it } from 'vitest';
import { HabitId } from '../../shared/identifiers';
import { MAX_PER_ACCOUNT } from '../domain/habit';
import { ANA, BETO, CHAT, build, chatVinculado, foto, unHabito, type World } from './support';

let world: World;

beforeEach(() => {
  world = build();
});

describe('los hábitos', () => {
  it('se crean y salen en orden', async () => {
    await unHabito(world, 'Ejercicio');
    await unHabito(world, 'Lectura');

    expect((await world.read.list(ANA)).map((habit) => habit.name)).toEqual([
      'Ejercicio',
      'Lectura',
    ]);
  });

  it('rechaza un nombre vacío', async () => {
    const created = await world.createHabit.execute(ANA, '   ');

    expect(created.ok ? '' : created.error.code).toBe('habit.invalid_name');
  });

  it('corta al llegar al tope', async () => {
    for (let index = 0; index < MAX_PER_ACCOUNT; index += 1) {
      await unHabito(world, `Hábito ${index}`);
    }

    const uno_mas = await world.createHabit.execute(ANA, 'Uno más');

    expect(uno_mas.ok ? '' : uno_mas.error.code).toBe('habit.too_many');
  });

  it('se renombra', async () => {
    const id = await unHabito(world, 'Ejercicio');

    await world.renameHabit.execute(ANA, id, 'Bici');

    expect((await world.read.list(ANA))[0]?.name).toBe('Bici');
  });
});

describe('borrar', () => {
  /*
   * Borrar un hábito se lleva su bitácora y sus archivos: si el usuario quisiera
   * guardar el historial habría archivado. Los objetos se quitan antes de la
   * fila porque después la cascada ya no diría cuáles eran.
   */
  it('el hábito se lleva sus anotaciones y sus fotos', async () => {
    chatVinculado(world);
    await unHabito(world, 'Ejercicio');
    await world.bot.handle({ chatId: CHAT, text: '/habits' });
    await world.bot.tap({
      chatId: CHAT,
      callbackId: 'tap-1',
      messageId: 1,
      data: world.voice.said.at(-1)?.buttons[0]?.data ?? '',
    });
    await world.bot.handle({ chatId: CHAT, text: null, photo: foto('f1') });
    await world.bot.handle({ chatId: CHAT, text: '/fin' });

    expect(world.photos.originals()).toBe(1);

    const id = (await world.read.list(ANA))[0]?.id ?? '';

    await world.deleteHabit.execute(ANA, HabitId.from(id));

    expect(await world.read.list(ANA)).toHaveLength(0);
    expect(world.photos.objects.size).toBe(0);
  });
});

describe('cada quien ve lo suyo', () => {
  it('el hábito ajeno no existe, en vez de estar prohibido', async () => {
    const id = await unHabito(world, 'Ejercicio', ANA);

    const ajeno = await world.read.entriesOf(BETO, id);

    expect(ajeno.ok ? '' : ajeno.error.code).toBe('habit.not_found');
    expect(ajeno.ok ? '' : ajeno.error.kind).toBe('not_found');
  });

  it('renombrar el ajeno tampoco se puede', async () => {
    const id = await unHabito(world, 'Ejercicio', ANA);

    const ajeno = await world.renameHabit.execute(BETO, id, 'Mío ahora');

    expect(ajeno.ok).toBe(false);
    expect((await world.read.list(ANA))[0]?.name).toBe('Ejercicio');
  });

  it('el listado solo trae los del dueño', async () => {
    await unHabito(world, 'De Ana', ANA);
    await unHabito(world, 'De Beto', BETO);

    expect(await world.read.list(ANA)).toHaveLength(1);
    expect(await world.read.list(BETO)).toHaveLength(1);
  });
});
