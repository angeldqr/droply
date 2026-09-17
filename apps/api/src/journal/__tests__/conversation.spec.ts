import { beforeEach, describe, expect, it } from 'vitest';
import { IDLE_MINUTES, PHOTOS_MAX } from '../domain/entry';
import {
  AHORA,
  ANA,
  BASURA,
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

/** El dato del botón de un hábito, tal como lo mandaría el teclado. */
function botonDe(world_: World, index = 0): string {
  return world_.voice.said.at(-1)?.buttons[index]?.data ?? '';
}

async function elegir(world_: World, index = 0): Promise<void> {
  await world_.bot.tap({
    chatId: CHAT,
    callbackId: 'tap-1',
    messageId: 10,
    data: botonDe(world_, index),
  });
}

describe('el chat que no es de nadie', () => {
  /*
   * Es la mitad del contrato con `recipients`: devolver `false` deja que el
   * mensaje siga su camino y que quien no tenga cuenta reciba la explicación de
   * siempre, en vez de la lista de hábitos de un desconocido.
   */
  it('no se hace cargo de nada', async () => {
    expect(await world.bot.handle({ chatId: '999', text: '/habits' })).toBe(false);
    expect(await world.bot.handle({ chatId: '999', text: 'hola' })).toBe(false);
    expect(world.voice.said).toHaveLength(0);
  });
});

describe('/habits', () => {
  beforeEach(() => {
    chatVinculado(world);
  });

  it('sin hábitos manda a la aplicación', async () => {
    expect(await world.bot.handle({ chatId: CHAT, text: '/habits' })).toBe(true);
    expect(world.voice.last()).toContain('Todavía no tienes hábitos');
  });

  it('manda la lista numerada, como pidió el cliente', async () => {
    await unHabito(world, 'Ejercicio');
    await unHabito(world, 'Alimentación');
    await unHabito(world, 'Lectura');

    await world.bot.handle({ chatId: CHAT, text: '/habits' });

    const botones = world.voice.said.at(-1)?.buttons ?? [];

    expect(botones.map((boton) => boton.label)).toEqual([
      '1 · Ejercicio · 0/1',
      '2 · Alimentación · 0/1',
      '3 · Lectura · 0/1',
    ]);
  });

  it('acepta el comando con el nombre del bot detrás, como en los grupos', async () => {
    await unHabito(world, 'Ejercicio');

    expect(await world.bot.handle({ chatId: CHAT, text: '/habits@reconectatebot' })).toBe(true);
    expect(world.voice.last()).toContain('cuál');
  });
});

describe('anotar', () => {
  beforeEach(async () => {
    chatVinculado(world);
    await unHabito(world, 'Ejercicio');
    await world.bot.handle({ chatId: CHAT, text: '/habits' });
  });

  /*
   * El caso del cliente, literal: elegir, contar, mandar tres fotos de golpe y
   * que salga **una** anotación con sus tres fotos, no cuatro sueltas.
   */
  it('junta el texto y las fotos en una sola anotación', async () => {
    await elegir(world);

    await world.bot.handle({ chatId: CHAT, text: '45 min de bici' });
    for (const id of ['f1', 'f2', 'f3']) {
      await world.bot.handle({ chatId: CHAT, text: null, photo: foto(id) });
    }

    await world.bot.handle({ chatId: CHAT, text: '/fin' });

    expect(world.entries.rows.size).toBe(1);

    const entry = [...world.entries.rows.values()][0]?.toSnapshot();

    expect(entry?.note).toBe('45 min de bici');
    expect(entry?.closedAt).not.toBeNull();
    expect(world.photos.originals()).toBe(3);
    expect(world.voice.last()).toBe(
      'Anotado en Ejercicio: lo que escribiste y 3 fotos. ¡Meta de hoy cumplida! 🎯',
    );
  });

  it('el pie de una foto cuenta como texto', async () => {
    await elegir(world);

    await world.bot.handle({
      chatId: CHAT,
      text: 'salí a correr',
      photo: foto('f1'),
    });
    await world.bot.handle({ chatId: CHAT, text: '/fin' });

    const entry = [...world.entries.rows.values()][0]?.toSnapshot();

    expect(entry?.note).toBe('salí a correr');
    expect(world.photos.originals()).toBe(1);
  });

  it('los mensajes seguidos se acumulan en vez de pisarse', async () => {
    await elegir(world);

    await world.bot.handle({ chatId: CHAT, text: 'primero' });
    await world.bot.handle({ chatId: CHAT, text: 'segundo' });
    await world.bot.handle({ chatId: CHAT, text: '/fin' });

    expect([...world.entries.rows.values()][0]?.toSnapshot().note).toBe('primero\nsegundo');
  });

  it('el botón Listo cierra igual que /fin y quita el teclado', async () => {
    await elegir(world);
    await world.bot.handle({ chatId: CHAT, text: 'algo' });

    // El teclado del mensaje de «cuéntame» lleva el botón de cerrar.
    await world.bot.tap({ chatId: CHAT, callbackId: 'tap-2', messageId: 20, data: botonDe(world) });

    expect([...world.entries.rows.values()][0]?.toSnapshot().closedAt).not.toBeNull();
    expect(world.voice.cleared).toContain(20);
  });

  /*
   * Elegir un hábito con una anotación abierta cierra la anterior: nadie está
   * escribiendo en dos sitios a la vez, y dejarla abierta pegaría lo nuevo a lo
   * viejo sin que nadie lo pidiera.
   */
  it('elegir otro hábito cierra lo que estaba abierto', async () => {
    await unHabito(world, 'Lectura');
    await elegir(world);
    await world.bot.handle({ chatId: CHAT, text: 'bici' });

    await world.bot.handle({ chatId: CHAT, text: '/habits' });
    await elegir(world, 1);
    await world.bot.handle({ chatId: CHAT, text: 'un capítulo' });
    await world.bot.handle({ chatId: CHAT, text: '/fin' });

    const notas = [...world.entries.rows.values()].map((entry) => entry.toSnapshot().note);

    expect(notas.sort()).toEqual(['bici', 'un capítulo']);
    expect([...world.entries.rows.values()].every((entry) => !entry.isOpen)).toBe(true);
  });

  /*
   * Lo que llega tarde no se tira: empieza una anotación nueva en el mismo
   * hábito, y el bot ofrece moverla por si adivinó mal.
   */
  it('lo que llega tarde abre una anotación nueva, sin perderse', async () => {
    await elegir(world);
    await world.bot.handle({ chatId: CHAT, text: 'lo de la mañana' });

    world.clock.set(new Date(AHORA.getTime() + (IDLE_MINUTES + 1) * 60 * 1000));
    await world.bot.handle({ chatId: CHAT, text: 'lo de la tarde' });

    const [vieja, nueva] = [...world.entries.rows.values()];

    expect(vieja?.isOpen).toBe(false);
    expect(vieja?.toSnapshot().note).toBe('lo de la mañana');
    expect(nueva?.isOpen).toBe(true);
    expect(nueva?.habitId).toBe(vieja?.habitId);
    expect(nueva?.toSnapshot().note).toBe('lo de la tarde');

    const aviso = world.voice.said.find((said) => said.text.includes('Pasó un rato'));

    expect(aviso?.buttons.map((button) => button.data)).toEqual(['j:d', 'j:o']);
  });

  it('un álbum que llega tarde cae entero en una sola anotación nueva', async () => {
    await elegir(world);
    await world.bot.handle({ chatId: CHAT, text: 'lo de la mañana' });

    world.clock.set(new Date(AHORA.getTime() + (IDLE_MINUTES + 1) * 60 * 1000));
    await Promise.all(
      ['f1', 'f2', 'f3'].map((id) =>
        world.bot.handle({ chatId: CHAT, text: null, photo: foto(id) }),
      ),
    );

    const abiertas = [...world.entries.rows.values()].filter((entry) => entry.isOpen);

    expect(abiertas).toHaveLength(1);
    expect(world.entries.photos.get(abiertas[0]!.id)).toHaveLength(3);
    expect(world.voice.said.filter((said) => said.text.includes('Pasó un rato'))).toHaveLength(1);
  });

  it('si lo que llega tarde es una foto rota, no anuncia nada nuevo', async () => {
    await elegir(world);
    await world.bot.handle({ chatId: CHAT, text: 'algo' });

    world.clock.set(new Date(AHORA.getTime() + (IDLE_MINUTES + 1) * 60 * 1000));
    world.voice.bytes = BASURA;
    await world.bot.handle({ chatId: CHAT, text: null, photo: foto('f1') });

    expect(world.voice.last()).toContain('solo entiendo fotos');
    expect(world.voice.said.some((said) => said.text.includes('Pasó un rato'))).toBe(false);
  });

  it('un sticker tarde cierra la vieja y sigue su camino', async () => {
    await elegir(world);
    await world.bot.handle({ chatId: CHAT, text: 'algo' });

    world.clock.set(new Date(AHORA.getTime() + (IDLE_MINUTES + 1) * 60 * 1000));

    expect(await world.bot.handle({ chatId: CHAT, text: null })).toBe(false);
    expect([...world.entries.rows.values()].every((entry) => !entry.isOpen)).toBe(true);
  });

  it('cada foto la mantiene viva, aunque la charla pase de media hora', async () => {
    const minutos = (m: number) => new Date(AHORA.getTime() + m * 60 * 1000);

    await elegir(world);
    world.clock.set(minutos(20));
    await world.bot.handle({ chatId: CHAT, text: null, photo: foto('f1') });
    world.clock.set(minutos(40));
    await world.bot.handle({ chatId: CHAT, text: 'y después estiramiento' });

    const [entry] = [...world.entries.rows.values()];

    expect(entry?.isOpen).toBe(true);
    expect(entry?.toSnapshot().note).toBe('y después estiramiento');
  });

  /*
   * Elegir un hábito y no contar nada no es una anotación en blanco: es que no
   * se quiso anotar. Una fila vacía en la pantalla es ruido que después hay que
   * limpiar a mano.
   */
  it('una anotación sin nada se borra en vez de cerrarse', async () => {
    await elegir(world);
    await world.bot.handle({ chatId: CHAT, text: '/fin' });

    expect(world.entries.rows.size).toBe(0);
    expect(world.voice.last()).toContain('No anoté nada');
  });

  it('sin anotación abierta, el mensaje sigue su camino', async () => {
    expect(await world.bot.handle({ chatId: CHAT, text: 'hola' })).toBe(false);
  });
});

describe('las fotos', () => {
  beforeEach(async () => {
    chatVinculado(world);
    await unHabito(world, 'Ejercicio');
    await world.bot.handle({ chatId: CHAT, text: '/habits' });
    await elegir(world);
  });

  /*
   * Se mira lo que llegó de verdad, no lo que Telegram dice. Acá es la única
   * defensa: del otro lado no hay una política firmada que corte antes de
   * escribir, como sí la hay en la subida del navegador.
   */
  it('rechaza lo que no es una imagen y lo dice', async () => {
    world.voice.bytes = BASURA;

    await world.bot.handle({ chatId: CHAT, text: null, photo: foto('f1') });

    expect(world.photos.objects.size).toBe(0);
    expect(world.voice.last()).toContain('solo entiendo fotos');
  });

  it('avisa si no pudo bajarla, en vez de callarse', async () => {
    world.voice.bytes = null;

    await world.bot.handle({ chatId: CHAT, text: null, photo: foto('f1') });

    expect(world.photos.objects.size).toBe(0);
    expect(world.voice.last()).toContain('No pude bajar');
  });

  it('corta en el tope y sigue tomando el texto', async () => {
    for (let index = 0; index <= PHOTOS_MAX; index += 1) {
      await world.bot.handle({
        chatId: CHAT,
        text: null,
        photo: foto(`f${index}`),
      });
    }

    expect(world.photos.originals()).toBe(PHOTOS_MAX);
    expect(world.voice.last()).toContain('El texto sí lo sigo tomando');

    await world.bot.handle({ chatId: CHAT, text: 'igual lo cuento' });
    await world.bot.handle({ chatId: CHAT, text: '/fin' });

    expect([...world.entries.rows.values()][0]?.toSnapshot().note).toBe('igual lo cuento');
  });
});

describe('los toques que no son suyos', () => {
  it('deja pasar el dato de otro, para que lo atienda quien sea', async () => {
    chatVinculado(world);

    expect(
      await world.bot.tap({
        chatId: CHAT,
        callbackId: 'tap-1',
        messageId: 1,
        // El de un voto de un plan de hábitos, que lleva otro prefijo.
        data: 'h:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee:D',
      }),
    ).toBe(false);
  });
});

describe('cada quien ve lo suyo', () => {
  it('el chat de Ana nunca ve los hábitos de Beto', async () => {
    chatVinculado(world);
    await unHabito(world, 'Lo de Ana', ANA);
    await unHabito(world, 'Lo de Beto', BETO);

    await world.bot.handle({ chatId: CHAT, text: '/habits' });

    const etiquetas = (world.voice.said.at(-1)?.buttons ?? []).map((boton) => boton.label);

    expect(etiquetas).toEqual(['1 · Lo de Ana · 0/1']);
  });
});

describe('pasar la anotación a otro hábito', () => {
  let lectura: string;

  beforeEach(async () => {
    chatVinculado(world);
    await unHabito(world, 'Ejercicio');
    lectura = await unHabito(world, 'Lectura');
    await world.bot.handle({ chatId: CHAT, text: '/habits' });
    await elegir(world);
    await world.bot.handle({ chatId: CHAT, text: 'veinte páginas' });
  });

  async function tocar(data: string): Promise<void> {
    await world.bot.tap({ chatId: CHAT, callbackId: 'tap-2', messageId: 11, data });
  }

  it('ofrece solo los otros hábitos y la mueve con un toque', async () => {
    await tocar('j:o');

    expect(world.voice.said.at(-1)?.buttons).toEqual([
      { label: '1 · Lectura', data: `j:m:${lectura}` },
    ]);

    await tocar(`j:m:${lectura}`);

    const [entry] = [...world.entries.rows.values()];

    expect(entry?.habitId).toBe(lectura);
    expect(entry?.isOpen).toBe(true);
    expect(world.voice.last()).toContain('lo pasé a Lectura');
  });

  it('no la mueve a un hábito de otra cuenta', async () => {
    const ajeno = await unHabito(world, 'De Beto', BETO);

    await tocar(`j:m:${ajeno}`);

    expect([...world.entries.rows.values()][0]?.habitId).not.toBe(ajeno);
    expect(world.voice.last()).toContain('Escribe /habits');
  });
});

describe('miniaturas', () => {
  beforeEach(async () => {
    chatVinculado(world);
    await unHabito(world, 'Ejercicio');
    await world.bot.handle({ chatId: CHAT, text: '/habits' });
    await elegir(world);
  });

  it('guarda la foto y su miniatura bajo el prefijo del dueño', async () => {
    await world.bot.handle({ chatId: CHAT, text: null, photo: foto('f1') });

    const [photo] = [...world.entries.photos.values()].flat();

    expect(photo?.storageKey.startsWith(`${ANA}/journal/`)).toBe(true);
    expect(photo?.thumbKey).toBe(`${photo?.storageKey}.min`);
    expect([...world.photos.objects.keys()].sort()).toEqual(
      [photo?.storageKey, photo?.thumbKey].sort(),
    );
  });

  it('si la miniatura no baja, la foto se guarda igual', async () => {
    world.voice.unreachable.add('f1-min');

    await world.bot.handle({ chatId: CHAT, text: null, photo: foto('f1') });

    const [photo] = [...world.entries.photos.values()].flat();

    expect(photo?.thumbKey).toBeNull();
    expect(world.photos.objects.size).toBe(1);
  });

  it('borrar la anotación borra también la miniatura', async () => {
    await world.bot.handle({ chatId: CHAT, text: null, photo: foto('f1') });
    await world.bot.handle({ chatId: CHAT, text: '/fin' });

    const [entry] = [...world.entries.rows.values()];

    await world.deleteEntry.execute(ANA, entry!.id);

    expect(world.photos.objects.size).toBe(0);
  });
});

describe('la meta del día', () => {
  beforeEach(() => {
    chatVinculado(world);
  });

  async function anotar(texto: string): Promise<void> {
    await world.bot.handle({ chatId: CHAT, text: '/habits' });
    await elegir(world);
    await world.bot.handle({ chatId: CHAT, text: texto });
    await world.bot.handle({ chatId: CHAT, text: '/fin' });
  }

  /*
   * La unidad es la anotación: una sesión con varios mensajes es una vez. Al
   * cerrar, el bot dice cómo va y felicita solo al alcanzar la meta.
   */
  it('cuenta anotaciones y felicita al llegar', async () => {
    await unHabito(world, 'Comidas', ANA, { dailyTarget: 2 });

    await world.bot.handle({ chatId: CHAT, text: '/habits' });
    await elegir(world);
    await world.bot.handle({ chatId: CHAT, text: 'Desayuno' });
    await world.bot.handle({ chatId: CHAT, text: 'con fruta' });
    await world.bot.handle({ chatId: CHAT, text: '/fin' });

    expect(world.voice.last()).toContain('Hoy llevas 1 de 2.');

    await anotar('Almuerzo');

    expect(world.voice.last()).toContain('¡Meta de hoy cumplida!');

    await world.bot.handle({ chatId: CHAT, text: '/habits' });

    expect(world.voice.said.at(-1)?.buttons[0]?.label).toBe('1 · Comidas · ✓');

    await elegir(world);
    await world.bot.handle({ chatId: CHAT, text: 'Cena' });
    await world.bot.handle({ chatId: CHAT, text: '/fin' });

    // Pasada la meta ya no hay nada que anunciar.
    expect(world.voice.last()).not.toMatch(/Hoy llevas|Meta/);
  });

  it('un día de descanso se puede anotar, pero no se mide', async () => {
    // AHORA es miércoles; el hábito es solo de sábado y domingo.
    await unHabito(world, 'Paseo', ANA, { activeDays: 0b110_0000 });

    await world.bot.handle({ chatId: CHAT, text: '/habits' });

    expect(world.voice.said.at(-1)?.buttons[0]?.label).toBe('1 · Paseo · descanso');

    await elegir(world);
    await world.bot.handle({ chatId: CHAT, text: 'Igual caminé' });
    await world.bot.handle({ chatId: CHAT, text: '/fin' });

    expect(world.voice.last()).toBe('Anotado en Paseo: lo que escribiste.');
  });
});
