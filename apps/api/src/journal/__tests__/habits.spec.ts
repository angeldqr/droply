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
    const created = await world.createHabit.execute(ANA, { name: '   ' });

    expect(created.ok ? '' : created.error.code).toBe('habit.invalid_name');
  });

  it('corta al llegar al tope', async () => {
    for (let index = 0; index < MAX_PER_ACCOUNT; index += 1) {
      await unHabito(world, `Hábito ${index}`);
    }

    const uno_mas = await world.createHabit.execute(ANA, { name: 'Uno más' });

    expect(uno_mas.ok ? '' : uno_mas.error.code).toBe('habit.too_many');
  });

  it('se renombra', async () => {
    const id = await unHabito(world, 'Ejercicio');

    await world.updateHabit.execute(ANA, id, { name: 'Bici' });

    expect((await world.read.list(ANA))[0]?.name).toBe('Bici');
  });
});

describe('la meta', () => {
  it('por defecto es una vez, todos los días', async () => {
    await unHabito(world, 'Ejercicio');

    expect((await world.read.list(ANA))[0]).toMatchObject({ dailyTarget: 1, activeDays: 127 });
  });

  it('al crear también rechaza metas fuera de rango', async () => {
    for (const goal of [{ dailyTarget: 0 }, { dailyTarget: 11 }, { activeDays: 0 }]) {
      const created = await world.createHabit.execute(ANA, { name: 'Gimnasio', ...goal });

      expect(created.ok ? '' : created.error.code).toBe('habit.invalid_goal');
    }

    expect(await world.read.list(ANA)).toHaveLength(0);
  });

  it('se cambia sin tocar el nombre', async () => {
    const id = await unHabito(world, 'Gimnasio');

    await world.updateHabit.execute(ANA, id, { dailyTarget: 2, activeDays: 0b001_1111 });

    expect((await world.read.list(ANA))[0]).toMatchObject({
      name: 'Gimnasio',
      dailyTarget: 2,
      activeDays: 0b001_1111,
    });
  });

  it('rechaza metas fuera de rango y no cambia nada', async () => {
    const id = await unHabito(world, 'Gimnasio');

    for (const changes of [{ dailyTarget: 0 }, { dailyTarget: 11 }, { activeDays: 0 }]) {
      const result = await world.updateHabit.execute(ANA, id, { name: 'Otro', ...changes });

      expect(result.ok ? '' : result.error.code).toBe('habit.invalid_goal');
    }

    expect((await world.read.list(ANA))[0]).toMatchObject({ name: 'Gimnasio', dailyTarget: 1 });
  });

  it('la lista trae la semana de lunes a domingo, sin contar las vacías', async () => {
    chatVinculado(world);
    await unHabito(world, 'Ejercicio');
    await world.bot.handle({ chatId: CHAT, text: '/habits' });
    await world.bot.tap({
      chatId: CHAT,
      callbackId: 'tap-1',
      messageId: 1,
      data: world.voice.said.at(-1)?.buttons[0]?.data ?? '',
    });

    // Recién elegido y sin nada contado: todavía no es una vez.
    expect((await world.read.list(ANA))[0]?.week.map((day) => day.count)).toEqual([
      0, 0, 0, 0, 0, 0, 0,
    ]);
    await world.bot.handle({ chatId: CHAT, text: 'Corrí' });

    // AHORA es miércoles 16: la semana va del lunes 14 al domingo 20.
    const [habit] = await world.read.list(ANA);

    expect(habit?.today).toBe('2026-09-16');
    expect(habit?.week.map((day) => day.day)).toEqual([
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
      '2026-09-19',
      '2026-09-20',
    ]);
    expect(habit?.week.map((day) => day.count)).toEqual([0, 0, 1, 0, 0, 0, 0]);
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

    const ajeno = await world.updateHabit.execute(BETO, id, { name: 'Mío ahora' });

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
