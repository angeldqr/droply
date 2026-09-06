import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, daysFrom, isBefore, isCivilDay } from './civil-day';

describe('días civiles', () => {
  it('cuenta días sin tropezar con el cambio de mes ni el bisiesto', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  /*
   * El caso que importa de verdad: en marzo, Santiago y media Europa cambian de
   * hora. Si estas cuentas se hicieran sobre instantes en vez de sobre fechas
   * civiles, el día siguiente saldría con veintitrés o veinticinco horas y un
   * plan se quedaría corto o largo de un día.
   */
  it('el día siguiente es el día siguiente aunque el reloj cambie', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
  });

  it('un plan de siete días que arranca el lunes termina el domingo', () => {
    // El primer día es el de hoy, así que el último es `inicio + 6`.
    expect(addDays('2026-05-11', 7 - 1)).toBe('2026-05-17');
    expect(daysFrom('2026-05-11', '2026-05-17')).toHaveLength(7);
  });

  it('ordena como el calendario, comparando como texto', () => {
    expect(isBefore('2026-01-09', '2026-01-10')).toBe(true);
    expect(isBefore('2026-02-01', '2026-01-31')).toBe(false);
  });

  it('rechaza una fecha que no existe aunque tenga la forma', () => {
    expect(isCivilDay('2026-02-30')).toBe(false);
    expect(isCivilDay('2026-13-01')).toBe(false);
    expect(isCivilDay('2026-02-28')).toBe(true);
  });

  it('un rango al revés no da días', () => {
    expect(daysFrom('2026-05-11', '2026-05-10')).toEqual([]);
  });
});
