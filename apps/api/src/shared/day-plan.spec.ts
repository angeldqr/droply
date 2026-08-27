import { describe, expect, it } from 'vitest';
import { dayOf, minutesOf, planOf, type PlannedItem } from './day-plan';

/** La franja del cliente: de 6:00 a 21:00. */
const INICIO = 6 * 60;
const FIN = 21 * 60;

const hhmm = (minute: number) =>
  `${Math.floor(minute / 60)}:${String(minute % 60).padStart(2, '0')}`;

/** El caso real: un audio, un video, una imagen y un texto. */
const BIBLIOTECA: PlannedItem[] = [
  { id: 'audio', timesPerDay: 3, position: 1 },
  { id: 'video', timesPerDay: 1, position: 2 },
  { id: 'imagen', timesPerDay: 3, position: 3 },
  { id: 'texto', timesPerDay: 2, position: 4 },
];

describe('el plan del día', () => {
  it('manda cada archivo las veces que pidió, ni una más ni una menos', () => {
    const plan = planOf(BIBLIOTECA, INICIO, FIN);
    const veces = new Map<string, number>();

    for (const send of plan) veces.set(send.itemId, (veces.get(send.itemId) ?? 0) + 1);

    expect(plan).toHaveLength(9);
    expect(veces.get('audio')).toBe(3);
    expect(veces.get('video')).toBe(1);
    expect(veces.get('imagen')).toBe(3);
    expect(veces.get('texto')).toBe(2);
  });

  it('le da a cada envío su propio momento, sin amontonarse', () => {
    const plan = planOf(BIBLIOTECA, INICIO, FIN);

    expect(new Set(plan.map((send) => send.minute)).size).toBe(9);
  });

  it('abre en la hora de inicio y cierra en la de fin', () => {
    const plan = planOf(BIBLIOTECA, INICIO, FIN);

    expect(plan[0]?.minute).toBe(INICIO);
    expect(plan.at(-1)?.minute).toBe(FIN);
  });

  it('intercala los archivos en vez de agrupar cada uno por su lado', () => {
    const plan = planOf(BIBLIOTECA, INICIO, FIN);

    // Nueve envíos entre 6:00 y 21:00, uno cada hora y cincuenta y dos.
    expect(plan.map((send) => `${hhmm(send.minute)} ${send.itemId}`)).toEqual([
      '6:00 audio',
      '7:53 imagen',
      '9:45 texto',
      '11:38 audio',
      '13:30 video',
      '15:23 imagen',
      '17:15 texto',
      '19:08 audio',
      '21:00 imagen',
    ]);
  });

  it('el orden del tablero decide el empate, así que arrastrar cambia la hora', () => {
    const alReves = planOf(
      [
        { id: 'imagen', timesPerDay: 3, position: 1 },
        { id: 'audio', timesPerDay: 3, position: 2 },
      ],
      INICIO,
      FIN,
    );

    expect(alReves[0]?.itemId).toBe('imagen');
  });

  it('un solo envío sale a la hora de inicio', () => {
    expect(planOf([{ id: 'audio', timesPerDay: 1, position: 1 }], INICIO, FIN)).toEqual([
      { minute: INICIO, itemId: 'audio' },
    ]);
  });

  it('una biblioteca vacía no tiene plan', () => {
    expect(planOf([], INICIO, FIN)).toEqual([]);
  });

  it('con más envíos que minutos, los que chocan se corren y no se pierden', () => {
    // Cuatro archivos de tres envíos en una franja de cinco minutos.
    const apretado = planOf(
      [
        { id: 'a', timesPerDay: 3, position: 1 },
        { id: 'b', timesPerDay: 3, position: 2 },
        { id: 'c', timesPerDay: 3, position: 3 },
        { id: 'd', timesPerDay: 3, position: 4 },
      ],
      600,
      605,
    );

    expect(apretado).toHaveLength(12);
    expect(apretado.every((send) => send.minute >= 600 && send.minute <= 605)).toBe(true);
  });

  it('la rejilla son los minutos del plan, sin repetir y en orden', () => {
    expect(
      minutesOf([
        { minute: 800, itemId: 'a' },
        { minute: 600, itemId: 'b' },
        { minute: 800, itemId: 'c' },
      ]),
    ).toEqual([600, 800]);
  });
});

/**
 * El día completo: lo clavado más el reparto.
 *
 * Es la función que decide qué sale y cuándo para los tres que lo preguntan
 * —la rejilla, el despacho y la vista previa—, así que lo que se pruebe acá es
 * lo que valdrá en los tres.
 */
describe('el día completo', () => {
  it('sin nada clavado es el reparto tal cual', () => {
    expect(dayOf(BIBLIOTECA, INICIO, FIN)).toEqual(planOf(BIBLIOTECA, INICIO, FIN));
  });

  /*
   * El caso que trajo el cliente: cuatro archivos, cada uno con su hora fija y
   * con sus propias veces al día. La hora clavada es **una** de esas veces, no
   * un sustituto, así que el día tiene los nueve envíos de siempre y cuatro de
   * ellos caen a la hora que él eligió.
   */
  it('una hora clavada es una de las veces del archivo, no las cancela', () => {
    const day = dayOf(BIBLIOTECA, INICIO, FIN, [
      { minute: 360, itemId: 'video' },
      { minute: 660, itemId: 'imagen' },
      { minute: 780, itemId: 'texto' },
      { minute: 1260, itemId: 'audio' },
    ]);

    // 3 + 1 + 3 + 2 = nueve envíos, los mismos que sin clavar nada.
    expect(day).toHaveLength(9);

    const veces = (itemId: string) => day.filter((send) => send.itemId === itemId).length;

    expect([veces('audio'), veces('video'), veces('imagen'), veces('texto')]).toEqual([3, 1, 3, 2]);

    // Y las cuatro horas elegidas salen con su archivo.
    expect(day).toContainEqual({ minute: 360, itemId: 'video' });
    expect(day).toContainEqual({ minute: 660, itemId: 'imagen' });
    expect(day).toContainEqual({ minute: 780, itemId: 'texto' });
    expect(day).toContainEqual({ minute: 1260, itemId: 'audio' });
  });

  it('lo clavado sigue contando para sus veces al día', () => {
    const day = dayOf(BIBLIOTECA, INICIO, FIN, [{ minute: 500, itemId: 'audio' }]);

    // `audio` pide tres: la clavada y dos más repartidas.
    expect(day.filter((send) => send.itemId === 'audio')).toHaveLength(3);
    expect(day).toContainEqual({ minute: 500, itemId: 'audio' });
  });

  it('el día entero sigue teniendo tantos envíos como veces se pidieron', () => {
    const day = dayOf(BIBLIOTECA, INICIO, FIN, [{ minute: 500, itemId: 'audio' }]);

    expect(day).toHaveLength(9);
  });

  /*
   * El punto del que depende todo lo demás. La hora clavada consume la parte
   * del día a la que se parece, así que clavar al principio deja las otras dos
   * salidas por el medio y el final. Si consumiera una del medio, el archivo
   * saldría dos veces casi seguidas al arrancar el día.
   */
  it('clavar al principio no amontona ahí las otras veces', () => {
    const day = dayOf(BIBLIOTECA, INICIO, FIN, [{ minute: INICIO, itemId: 'audio' }]);
    const suyas = day.filter((send) => send.itemId === 'audio').map((send) => send.minute);

    expect(suyas[0]).toBe(INICIO);
    // Las otras dos quedan en la segunda mitad larga del día, no pegadas.
    expect(suyas[1]).toBeGreaterThan(INICIO + (FIN - INICIO) / 4);
    expect(suyas[2]).toBeGreaterThan(INICIO + (FIN - INICIO) / 2);
  });

  it('ningún archivo sale dos veces en el mismo minuto', () => {
    const day = dayOf(BIBLIOTECA, INICIO, FIN, [
      { minute: 360, itemId: 'video' },
      { minute: 660, itemId: 'imagen' },
      { minute: 780, itemId: 'texto' },
      { minute: 1260, itemId: 'audio' },
    ]);

    expect(new Set(day.map((send) => send.minute)).size).toBe(day.length);
  });

  it('clavar más horas de las que pide un archivo hace que manden las horas', () => {
    const day = dayOf([{ id: 'a', timesPerDay: 1, position: 1 }], INICIO, FIN, [
      { minute: 400, itemId: 'a' },
      { minute: 800, itemId: 'a' },
    ]);

    expect(day).toEqual([
      { minute: 400, itemId: 'a' },
      { minute: 800, itemId: 'a' },
    ]);
  });

  it('una hora clavada de un archivo que el horario filtró sale igual, y sola', () => {
    // El horario solo manda imágenes, así que `cancion` no está en el reparto.
    const day = dayOf([{ id: 'foto', timesPerDay: 1, position: 1 }], INICIO, FIN, [
      { minute: 700, itemId: 'cancion' },
    ]);

    expect(day.filter((send) => send.itemId === 'cancion')).toEqual([
      { minute: 700, itemId: 'cancion' },
    ]);
  });

  /*
   * El envío automático quería el inicio de la franja, que ya tiene dueño. No
   * se le pone un minuto después —eso serían dos envíos casi pegados y luego el
   * día entero vacío—: los huecos se reparten contando también el clavado, así
   * que se va al otro extremo.
   */
  it('el reparto no se pega a una hora clavada, se va al hueco que queda', () => {
    const day = dayOf([{ id: 'a', timesPerDay: 1, position: 1 }], INICIO, FIN, [
      { minute: INICIO, itemId: 'otro' },
    ]);

    expect(day).toEqual([
      { minute: INICIO, itemId: 'otro' },
      { minute: FIN, itemId: 'a' },
    ]);
  });

  it('ningún envío queda a menos de un cuarto de hora de una hora clavada', () => {
    const day = dayOf(BIBLIOTECA, INICIO, FIN, [
      { minute: INICIO, itemId: 'video' },
      { minute: FIN, itemId: 'audio' },
    ]);

    for (const send of day) {
      if (send.minute === INICIO || send.minute === FIN) continue;

      expect(Math.min(send.minute - INICIO, FIN - send.minute)).toBeGreaterThan(15);
    }
  });

  it('sale ordenado por hora, con lo clavado en su sitio', () => {
    const day = dayOf(BIBLIOTECA, INICIO, FIN, [{ minute: 900, itemId: 'video' }]);
    const minutos = day.map((send) => send.minute);

    expect(minutos).toEqual([...minutos].sort((left, right) => left - right));
  });
});
