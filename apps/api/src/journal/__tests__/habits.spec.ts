import { beforeEach, describe, expect, it } from 'vitest';
import { HabitEntryId, HabitId } from '../../shared/identifiers';
import { MAX_PER_ACCOUNT } from '../domain/habit';
import {
  AHORA,
  ANA,
  BETO,
  CHAT,
  build,
  chatVinculado,
  foto,
  unHabito,
  type World,
} from './support';

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

describe('pausar', () => {
  const DIA = 24 * 60 * 60 * 1000;

  it('pausa desde hoy y al reanudar otro día guarda el tramo hasta ayer', async () => {
    const id = await unHabito(world, 'Gimnasio');

    await world.pauseHabit.execute(ANA, id);
    expect((await world.read.list(ANA))[0]).toMatchObject({
      paused: true,
      pauses: [{ from: '2026-09-16', to: null }],
    });

    world.clock.advanceBy(3 * DIA);
    await world.resumeHabit.execute(ANA, id);

    expect((await world.read.list(ANA))[0]).toMatchObject({
      paused: false,
      pauses: [{ from: '2026-09-16', to: '2026-09-18' }],
    });
  });

  it('una pausa de cero días no deja rastro', async () => {
    const id = await unHabito(world, 'Gimnasio');

    await world.pauseHabit.execute(ANA, id);
    await world.resumeHabit.execute(ANA, id);

    expect((await world.read.list(ANA))[0]?.pauses).toEqual([]);
  });

  it('no pausa dos veces ni reanuda lo que no está en pausa', async () => {
    const id = await unHabito(world, 'Gimnasio');

    const reanudar = await world.resumeHabit.execute(ANA, id);

    expect(reanudar.ok ? '' : reanudar.error.code).toBe('habit.not_paused');

    await world.pauseHabit.execute(ANA, id);
    const otra = await world.pauseHabit.execute(ANA, id);

    expect(otra.ok ? '' : otra.error.code).toBe('habit.already_paused');
  });

  it('editar el hábito no borra su pausa', async () => {
    const id = await unHabito(world, 'Gimnasio');

    await world.pauseHabit.execute(ANA, id);
    await world.updateHabit.execute(ANA, id, { name: 'Pesas' });

    expect((await world.read.list(ANA))[0]).toMatchObject({ name: 'Pesas', paused: true });
  });

  it('no se pausa un hábito ajeno', async () => {
    const id = await unHabito(world, 'Gimnasio', ANA);

    const ajeno = await world.pauseHabit.execute(BETO, id);

    expect(ajeno.ok ? '' : ajeno.error.code).toBe('habit.not_found');
    expect((await world.read.list(ANA))[0]?.paused).toBe(false);
  });

  it('los días en pausa no cortan la racha', async () => {
    chatVinculado(world);
    world.clock.set(new Date(AHORA.getTime() - 3 * DIA));
    const id = await unHabito(world, 'Lectura');

    const anotar = async () => {
      await world.bot.handle({ chatId: CHAT, text: '/habits' });
      await world.bot.tap({
        chatId: CHAT,
        callbackId: 't',
        messageId: 1,
        data: world.voice.said.at(-1)?.buttons[0]?.data ?? '',
      });
      await world.bot.handle({ chatId: CHAT, text: 'Leí' });
      await world.bot.handle({ chatId: CHAT, text: '/fin' });
    };

    await anotar();
    world.clock.advanceBy(DIA);
    await world.pauseHabit.execute(ANA, id);
    world.clock.advanceBy(2 * DIA);
    await world.resumeHabit.execute(ANA, id);
    await anotar();

    expect((await world.read.list(ANA))[0]?.streak).toBe(2);
  });
});

describe('corregir una anotación', () => {
  const DIA = 24 * 60 * 60 * 1000;

  /** Anota algo y devuelve el identificador de lo anotado. */
  async function anotado(indice = 0): Promise<string> {
    await world.bot.handle({ chatId: CHAT, text: '/habits' });
    await world.bot.tap({
      chatId: CHAT,
      callbackId: 't',
      messageId: 1,
      data: world.voice.said.at(-1)?.buttons[indice]?.data ?? '',
    });
    await world.bot.handle({ chatId: CHAT, text: 'Lo que sea' });
    await world.bot.handle({ chatId: CHAT, text: '/fin' });

    return [...world.entries.rows.keys()].at(-1) ?? '';
  }

  beforeEach(() => {
    chatVinculado(world);
  });

  it('cambia el texto, el hábito y el día', async () => {
    const ejercicio = await unHabito(world, 'Ejercicio');
    const lectura = await unHabito(world, 'Lectura');
    const id = await anotado();

    const corregida = await world.editEntry.execute(ANA, HabitEntryId.from(id), {
      note: '  Corrido, 5 km  ',
      habitId: lectura,
      day: '2026-09-15',
    });

    expect(corregida.ok).toBe(true);

    const enLectura = await world.read.entriesOf(ANA, lectura);

    expect(enLectura.ok && enLectura.value[0]?.note).toBe('Corrido, 5 km');
    // La hora se conserva: solo se corre el día.
    expect(enLectura.ok && enLectura.value[0]?.openedAt.toISOString()).toBe(
      '2026-09-15T15:00:00.000Z',
    );

    const enEjercicio = await world.read.entriesOf(ANA, ejercicio);

    expect(enEjercicio.ok && enEjercicio.value).toHaveLength(0);
  });

  it('mover una anotación de día mueve el conteo y la racha', async () => {
    world.clock.set(new Date(AHORA.getTime() - DIA));
    await unHabito(world, 'Ejercicio');
    await anotado();
    world.clock.set(AHORA);
    const hoy = await anotado();

    expect((await world.read.list(ANA))[0]?.streak).toBe(2);

    // Las dos al mismo día: hoy vuelve a estar pendiente y la racha baja a uno.
    await world.editEntry.execute(ANA, HabitEntryId.from(hoy), { day: '2026-09-15' });

    const [habito] = await world.read.list(ANA);

    expect(habito?.streak).toBe(1);
    expect(habito?.week.find((day) => day.day === '2026-09-15')?.count).toBe(2);
  });

  it('una anotación abierta en el chat no se corrige', async () => {
    await unHabito(world, 'Ejercicio');
    await world.bot.handle({ chatId: CHAT, text: '/habits' });
    await world.bot.tap({
      chatId: CHAT,
      callbackId: 't',
      messageId: 1,
      data: world.voice.said.at(-1)?.buttons[0]?.data ?? '',
    });
    await world.bot.handle({ chatId: CHAT, text: 'Sigo contando' });

    const id = [...world.entries.rows.keys()].at(-1) ?? '';
    const abierta = await world.editEntry.execute(ANA, HabitEntryId.from(id), { note: 'Otra' });

    expect(abierta.ok ? '' : abierta.error.code).toBe('habit_entry.open');
  });

  it('no se mueve a un hábito ajeno ni a uno en pausa', async () => {
    await unHabito(world, 'Ejercicio');
    const lectura = await unHabito(world, 'Lectura');
    const ajeno = await unHabito(world, 'De Beto', BETO);
    const id = await anotado();

    const aAjeno = await world.editEntry.execute(ANA, HabitEntryId.from(id), { habitId: ajeno });

    expect(aAjeno.ok ? '' : aAjeno.error.code).toBe('habit.not_found');

    await world.pauseHabit.execute(ANA, lectura);
    const aPausado = await world.editEntry.execute(ANA, HabitEntryId.from(id), {
      habitId: lectura,
    });

    expect(aPausado.ok ? '' : aPausado.error.code).toBe('habit.paused');
  });

  it('corregirle el texto a un hábito en pausa sí se puede', async () => {
    const ejercicio = await unHabito(world, 'Ejercicio');
    const id = await anotado();

    await world.pauseHabit.execute(ANA, ejercicio);

    // Se manda el mismo hábito, como hace la pantalla: no es mover nada.
    const corregida = await world.editEntry.execute(ANA, HabitEntryId.from(id), {
      note: 'Con una falta menos',
      habitId: ejercicio,
    });

    expect(corregida.ok).toBe(true);
  });

  it('no se mueve a un día que no ha llegado', async () => {
    await unHabito(world, 'Ejercicio');
    const id = await anotado();

    const futuro = await world.editEntry.execute(ANA, HabitEntryId.from(id), {
      day: '2026-09-20',
    });

    expect(futuro.ok ? '' : futuro.error.code).toBe('habit_entry.future_day');
  });

  /*
   * Una caducada sigue abierta en la base. Si al corregirla se quedara así, el
   * mensaje siguiente del chat se pegaría al texto recién corregido.
   */
  it('corregir una caducada la deja cerrada', async () => {
    await unHabito(world, 'Ejercicio');
    await world.bot.handle({ chatId: CHAT, text: '/habits' });
    await world.bot.tap({
      chatId: CHAT,
      callbackId: 't',
      messageId: 1,
      data: world.voice.said.at(-1)?.buttons[0]?.data ?? '',
    });
    await world.bot.handle({ chatId: CHAT, text: 'A medio contar' });

    const id = [...world.entries.rows.keys()].at(-1) ?? '';

    world.clock.advanceBy(40 * 60 * 1000);
    await world.editEntry.execute(ANA, HabitEntryId.from(id), { note: 'Ya está' });
    await world.bot.handle({ chatId: CHAT, text: 'Algo más' });

    const bitacora = await world.read.entriesOf(
      ANA,
      HabitId.from((await world.read.list(ANA))[0]?.id ?? ''),
    );

    expect(bitacora.ok && bitacora.value[0]?.note).toBe('Ya está');
  });

  it('la anotación ajena no existe', async () => {
    await unHabito(world, 'Ejercicio');
    const id = await anotado();

    const ajena = await world.editEntry.execute(BETO, HabitEntryId.from(id), { note: 'Mía' });

    expect(ajena.ok ? '' : ajena.error.code).toBe('habit_entry.not_found');
  });
});
