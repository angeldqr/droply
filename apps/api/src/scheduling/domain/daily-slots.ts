import { slotsOf } from '../../shared/daily-slots';
import type { DailyWindow } from './ports';

/**
 * La ventana lista para el planificador, a partir de los campos del horario.
 *
 * `timesPerDayOfEachItem` llega vacío mientras no haya elementos que consultar;
 * el horario entonces sale una vez al día, a la hora de inicio.
 */
export function windowOf(
  fields: { weekdays: readonly number[]; startMinute: number; endMinute: number },
  timesPerDayOfEachItem: readonly number[] = [],
): DailyWindow {
  return {
    weekdays: fields.weekdays,
    minutes: gridOf(timesPerDayOfEachItem, fields.startMinute, fields.endMinute),
  };
}

/**
 * La rejilla del horario: todos los minutos en los que tiene algo que enviar.
 *
 * Es la unión de los repartos de cada elemento, sin repetidos y en orden. Un
 * archivo que pide cinco envíos densifica la rejilla para todo el horario, y en
 * cada disparo salen solo los elementos a los que les toca ese minuto.
 */
export function gridOf(
  timesPerDayOfEachItem: readonly number[],
  startMinute: number,
  endMinute: number,
): number[] {
  // Sin elementos no hay nada que enviar, pero el horario sigue vivo: se usa la
  // hora de inicio para que vuelva a mirar cuando alguien llene la biblioteca.
  if (timesPerDayOfEachItem.length === 0) return [startMinute];

  const minutes = new Set<number>();

  for (const times of timesPerDayOfEachItem) {
    for (const minute of slotsOf(times, startMinute, endMinute)) minutes.add(minute);
  }

  return [...minutes].sort((left, right) => left - right);
}
