import { describe, expect, it } from 'vitest';
import { dueProgressSlot, progressMinutes } from './progress-slots';

const MEDIANOCHE = new Date('2026-05-11T05:00:00.000Z');
const a = (hora: string) => new Date(`2026-05-11T${hora}:00.000Z`);

describe('a qué horas salen los avisos', () => {
  it('se reparten entre las 8 y las 20', () => {
    expect(progressMinutes(0)).toEqual([]);
    expect(progressMinutes(1)).toEqual([20 * 60]);
    expect(progressMinutes(3)).toEqual([8 * 60, 14 * 60, 20 * 60]);
    expect(progressMinutes(4)).toEqual([8 * 60, 12 * 60, 16 * 60, 20 * 60]);
  });
});

describe('cuál toca mandar', () => {
  const base = { midnight: MEDIANOCHE, perDay: 3, lastSentAt: null, notBefore: a('00:00') };

  it('ninguno antes del primero', () => {
    expect(dueProgressSlot({ ...base, now: a('12:59') })).toBeNull();
  });

  it('el de las 8 de Bogotá, pasadas las 8', () => {
    expect(dueProgressSlot({ ...base, now: a('13:05') })).toEqual(a('13:00'));
  });

  it('no repite el que ya salió', () => {
    expect(dueProgressSlot({ ...base, now: a('13:05'), lastSentAt: a('13:00') })).toBeNull();
  });

  it('tras una caída manda solo el más reciente', () => {
    expect(dueProgressSlot({ ...base, now: a('23:30') })).toEqual(a('19:00'));
  });

  it('no manda uno de antes de crear el plan', () => {
    expect(dueProgressSlot({ ...base, now: a('20:00'), notBefore: a('19:30') })).toBeNull();
  });
});
