import { describe, expect, it } from 'vitest';
import {
  addDays,
  ALL_DAYS,
  appliesOn,
  atDayIn,
  dayIn,
  isMilestone,
  isPausedOn,
  progressOf,
  weekdayOf,
  WEEKDAYS_ONLY,
} from './habit-progress.js';

// El 14 de septiembre de 2026 es lunes.
const MONDAY = '2026-09-14';

function days(entries: Record<string, number>): Map<string, number> {
  return new Map(Object.entries(entries));
}

describe('los días de la semana', () => {
  it('el lunes es el bit 0 y el domingo el 6', () => {
    expect(weekdayOf(MONDAY)).toBe(0);
    expect(weekdayOf(addDays(MONDAY, 6))).toBe(6);
    expect(appliesOn(WEEKDAYS_ONLY, addDays(MONDAY, 4))).toBe(true);
    expect(appliesOn(WEEKDAYS_ONLY, addDays(MONDAY, 5))).toBe(false);
  });

  it('corta el día en la zona que le toca', () => {
    // 21:00 en Bogotá ya es el día siguiente en UTC.
    const moment = new Date('2026-09-17T02:00:00Z');

    expect(dayIn('America/Bogota', moment)).toBe('2026-09-16');
    expect(dayIn('UTC', moment)).toBe('2026-09-17');
  });

  it('mueve un instante a otro día conservando la hora local', () => {
    // 00:30 del 25 de octubre en Madrid, la madrugada en que se atrasa el reloj.
    const moment = new Date('2026-10-24T22:30:00Z');

    const movido = atDayIn('Europe/Madrid', moment, '2026-10-26');

    expect(dayIn('Europe/Madrid', movido)).toBe('2026-10-26');
    expect(atDayIn('America/Bogota', moment, '2026-10-20').toISOString()).toBe(
      '2026-10-20T22:30:00.000Z',
    );
  });

  it('cruza fin de mes sin perderse', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('progressOf', () => {
  it('con meta 2, una vez es la mitad y no cuenta para la racha', () => {
    const progress = progressOf({
      perDay: days({ '2026-09-14': 2, '2026-09-15': 1 }),
      goal: { dailyTarget: 2, activeDays: ALL_DAYS },
      since: '2026-09-14',
      today: '2026-09-16',
    });

    expect(progress.streak).toBe(0);
    expect(progress.bestStreak).toBe(1);
    expect(progress.rate).toBe(0.75);
    expect(progress.todayCount).toBe(0);
  });

  it('el fin de semana libre no corta la racha', () => {
    const progress = progressOf({
      perDay: days({ '2026-09-11': 1, '2026-09-14': 1 }),
      goal: { dailyTarget: 1, activeDays: WEEKDAYS_ONLY },
      since: '2026-09-11',
      today: '2026-09-14',
    });

    expect(progress.streak).toBe(2);
    expect(progress.rate).toBe(1);
  });

  it('hoy a medias no corta la racha ni baja el porcentaje', () => {
    const progress = progressOf({
      perDay: days({ '2026-09-14': 3, '2026-09-15': 1 }),
      goal: { dailyTarget: 3, activeDays: ALL_DAYS },
      since: '2026-09-14',
      today: '2026-09-15',
    });

    expect(progress.streak).toBe(1);
    expect(progress.rate).toBe(1);
    expect(progress.todayDone).toBe(false);
  });

  it('pasarse de la meta no suma más del cien por ciento', () => {
    const progress = progressOf({
      perDay: days({ '2026-09-14': 5, '2026-09-15': 0 }),
      goal: { dailyTarget: 1, activeDays: ALL_DAYS },
      since: '2026-09-14',
      today: '2026-09-16',
    });

    expect(progress.rate).toBe(0.5);
  });

  it('lo anterior a la creación no cuenta', () => {
    const progress = progressOf({
      // Lo del 14 no puede sumar: el hábito nació el 16.
      perDay: days({ '2026-09-14': 1, '2026-09-15': 0, '2026-09-16': 1 }),
      goal: { dailyTarget: 1, activeDays: ALL_DAYS },
      since: '2026-09-16',
      today: '2026-09-16',
    });

    expect(progress).toMatchObject({ streak: 1, rate: 1, todayDone: true });
  });

  it('anotar en un día libre no lo da por cumplido', () => {
    const progress = progressOf({
      perDay: days({ '2026-09-19': 1 }),
      goal: { dailyTarget: 1, activeDays: WEEKDAYS_ONLY },
      since: '2026-09-19',
      today: '2026-09-19',
    });

    expect(progress).toMatchObject({ todayApplies: false, todayDone: false, rate: null });
  });

  it('la pausa no corta la racha ni baja el porcentaje', () => {
    const progress = progressOf({
      perDay: days({ '2026-09-14': 1, '2026-09-18': 1 }),
      goal: { dailyTarget: 1, activeDays: ALL_DAYS },
      since: '2026-09-14',
      today: '2026-09-18',
      pauses: [{ from: '2026-09-15', to: '2026-09-17' }],
    });

    expect(progress).toMatchObject({ streak: 2, rate: 1 });
  });

  it('hoy en pausa no aplica', () => {
    const progress = progressOf({
      perDay: days({}),
      goal: { dailyTarget: 1, activeDays: ALL_DAYS },
      since: '2026-09-14',
      today: '2026-09-16',
      pauses: [{ from: '2026-09-16', to: null }],
    });

    expect(progress.todayApplies).toBe(false);
    expect(isPausedOn([{ from: '2026-09-16', to: null }], '2027-01-01')).toBe(true);
    expect(isPausedOn([{ from: '2026-09-16', to: '2026-09-17' }], '2026-09-18')).toBe(false);
  });

  it('reconoce los hitos', () => {
    expect([6, 7, 30, 31].map(isMilestone)).toEqual([false, true, true, false]);
  });

  it('sin días aplicables todavía, no hay porcentaje', () => {
    const progress = progressOf({
      perDay: days({}),
      goal: { dailyTarget: 1, activeDays: ALL_DAYS },
      since: '2026-09-16',
      today: '2026-09-16',
    });

    expect(progress.rate).toBeNull();
  });
});
