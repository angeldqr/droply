import type { DailyWindow } from './ports';

/**
 * A qué horas del día sale un elemento que pide enviarse `timesPerDay` veces.
 *
 * Los envíos se reparten **de extremo a extremo** de la franja: el primero a la
 * hora de inicio, el último a la de fin, y el resto igualmente espaciados en
 * medio. Con la franja de 8:00 a 20:00 y tres envíos salen a las 8:00, 14:00 y
 * 20:00 — la primera hora, la del medio y la última.
 *
 * Se reparte sobre `n - 1` huecos y no sobre `n` justamente para que el último
 * caiga en el fin de la franja. Repartir sobre `n` dejaría el último antes del
 * cierre, y la franja diría una hora que nunca se usa.
 *
 * Una sola vez al día sale al inicio: sin un segundo punto no hay reparto que
 * hacer, y el inicio es lo que el usuario eligió como "la hora del envío".
 *
 * Los minutos se redondean, así que dos repeticiones vecinas pueden caer en el
 * mismo minuto si la franja es muy corta; quien reciba la lista debe quitar
 * duplicados.
 */
export function slotsOf(timesPerDay: number, startMinute: number, endMinute: number): number[] {
  const times = Math.max(1, Math.floor(timesPerDay));

  if (times === 1) return [startMinute];

  const step = (endMinute - startMinute) / (times - 1);

  return Array.from({ length: times }, (_, index) => Math.round(startMinute + step * index));
}

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
