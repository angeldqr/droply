import { describe, expect, it } from 'vitest';
import { slotsOf } from '../../shared/daily-slots';
import { gridOf, windowOf } from '../domain/daily-slots';
import { WindowOccurrencePlanner } from '../infrastructure/window-occurrence-planner';

const planner = new WindowOccurrencePlanner();

const TODOS_LOS_DIAS = [1, 2, 3, 4, 5, 6, 7];

/** Qué marca el reloj en esa zona, para leer los tests de un vistazo. */
function localTime(moment: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(moment);
}

/** Una ventana de un solo minuto al día, para fijar la hora exacta. */
function at(minute: number, weekdays: number[] = TODOS_LOS_DIAS) {
  return { weekdays, minutes: [minute] };
}

const LAS_8 = 8 * 60;
const LAS_2_30 = 2 * 60 + 30;

describe('reparto dentro de la franja', () => {
  it('reparte tres envíos en la primera hora, la del medio y la última', () => {
    // 8:00 a 20:00, que es lo que pidió el cliente con este mismo ejemplo.
    expect(slotsOf(3, 480, 1200)).toEqual([480, 840, 1200]);
  });

  it('una sola vez al día sale a la hora de inicio', () => {
    expect(slotsOf(1, 480, 1200)).toEqual([480]);
  });

  it('cinco envíos caen igualmente espaciados, extremos incluidos', () => {
    expect(slotsOf(5, 480, 1200)).toEqual([480, 660, 840, 1020, 1200]);
  });

  it('la rejilla une los repartos de todos los elementos, sin repetir', () => {
    // Uno que sale una vez y otro que sale tres comparten la hora de inicio.
    expect(gridOf([1, 3], 480, 1200)).toEqual([480, 840, 1200]);
  });

  it('una biblioteca vacía deja la rejilla en la hora de inicio', () => {
    expect(gridOf([], 480, 1200)).toEqual([480]);
  });
});

describe('próxima hora de envío', () => {
  it('mantiene la hora local aunque cambie el desfase con UTC', () => {
    // Madrid está en +1 en invierno y en +2 en verano: si el cálculo fuera en
    // UTC pelado, el envío de las 8 se correría media año a las 7 o a las 9.
    const invierno = planner.nextAfter(
      at(LAS_8),
      'Europe/Madrid',
      new Date('2026-01-15T12:00:00Z'),
    );
    const verano = planner.nextAfter(at(LAS_8), 'Europe/Madrid', new Date('2026-07-15T12:00:00Z'));

    expect(localTime(invierno!, 'Europe/Madrid')).toContain('08:00');
    expect(localTime(verano!, 'Europe/Madrid')).toContain('08:00');
    // Y son instantes UTC distintos, que es justo lo que hay que acertar.
    expect(invierno!.getUTCHours()).toBe(7);
    expect(verano!.getUTCHours()).toBe(6);
  });

  it('corre hacia adelante la hora que no existe el día que adelantan los relojes', () => {
    /*
     * En Madrid, el 29 de marzo de 2026 el reloj salta de las 2:00 a las 3:00:
     * las 2:30 de ese día no existen. Un envío a esa hora no puede desaparecer
     * ni devolver una fecha inválida: se corre a las 3:30.
     */
    const next = planner.nextAfter(at(LAS_2_30), 'Europe/Madrid', new Date('2026-03-28T12:00:00Z'));

    expect(next).not.toBeNull();
    expect(localTime(next!, 'Europe/Madrid')).toBe('29/03, 03:30');
  });

  it('elige la primera de las dos veces que ocurre la hora repetida', () => {
    /*
     * El 25 de octubre de 2026 los relojes atrasan y las 2:30 ocurren dos
     * veces, una en +2 y otra en +1. Hay que quedarse con una sola: con las dos,
     * el destinatario recibiría el mismo envío dos veces.
     */
    const next = planner.nextAfter(at(LAS_2_30), 'Europe/Madrid', new Date('2026-10-24T12:00:00Z'));

    expect(next).not.toBeNull();
    expect(localTime(next!, 'Europe/Madrid')).toBe('25/10, 02:30');
    // La primera pasada es la de +2, o sea las 00:30 UTC.
    expect(next!.toISOString()).toBe('2026-10-25T00:30:00.000Z');
  });

  it('en una zona sin horario de verano no se mueve nada', () => {
    const enero = planner.nextAfter(at(LAS_8), 'America/Bogota', new Date('2026-01-15T20:00:00Z'));
    const julio = planner.nextAfter(at(LAS_8), 'America/Bogota', new Date('2026-07-15T20:00:00Z'));

    expect(enero!.toISOString()).toBe('2026-01-16T13:00:00.000Z');
    expect(julio!.toISOString()).toBe('2026-07-16T13:00:00.000Z');
  });

  it('salta los días que no están elegidos', () => {
    // Solo lunes. El 2026-05-13 es miércoles, así que toca el lunes siguiente.
    const next = planner.nextAfter(
      at(LAS_8, [1]),
      'America/Bogota',
      new Date('2026-05-13T20:00:00Z'),
    );

    expect(localTime(next!, 'America/Bogota')).toBe('18/05, 08:00');
  });

  it('el mismo día más tarde, si todavía queda una hora por delante', () => {
    const manana = 9 * 60;
    const tarde = 18 * 60;

    const next = planner.nextAfter(
      { weekdays: TODOS_LOS_DIAS, minutes: [manana, tarde] },
      'America/Bogota',
      // 14:00 en Bogotá: ya pasó la de la mañana, falta la de la tarde.
      new Date('2026-05-13T19:00:00Z'),
    );

    expect(localTime(next!, 'America/Bogota')).toBe('13/05, 18:00');
  });

  it('sin días o sin horas no hay próxima ocurrencia', () => {
    const ahora = new Date('2026-05-13T19:00:00Z');

    expect(
      planner.nextAfter({ weekdays: [], minutes: [LAS_8] }, 'America/Bogota', ahora),
    ).toBeNull();
    expect(planner.nextAfter({ weekdays: [1], minutes: [] }, 'America/Bogota', ahora)).toBeNull();
  });

  it('nunca devuelve una fecha anterior o igual al punto de partida', () => {
    const from = new Date('2026-05-10T13:00:00Z');
    const next = planner.nextAfter(at(LAS_8), 'America/Bogota', from);

    expect(next!.getTime()).toBeGreaterThan(from.getTime());
  });

  it('arma la ventana desde los campos del horario', () => {
    const window = windowOf({ weekdays: [1, 3], startMinute: 480, endMinute: 1200 }, [3]);

    expect(window).toEqual({ weekdays: [1, 3], minutes: [480, 840, 1200] });
  });
});
