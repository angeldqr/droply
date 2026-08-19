import { describe, expect, it } from 'vitest';
import { minutesOf, planOf, type PlannedItem } from './day-plan';

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
