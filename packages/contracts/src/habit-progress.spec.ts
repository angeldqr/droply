import { describe, expect, it } from 'vitest';
import {
  addDays,
  ALL_DAYS,
  appliesOn,
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
