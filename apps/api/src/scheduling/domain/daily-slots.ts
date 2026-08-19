import { minutesOf, planOf, type PlannedItem } from '../../shared/day-plan';
import type { DailyWindow } from './ports';

/**
 * La ventana lista para el planificador, a partir de los campos del horario.
 *
 * La rejilla —las horas a las que el horario tiene que despertarse— sale del
 * plan del día: cada elemento aporta tantos momentos como veces al día pida, y
 * todos se intercalan dentro de la franja.
 *
 * `fixedMinutes` son las horas con un envío clavado. Entran aunque el plan no
 * las pise: si alguien pide algo a las 7:15, el horario tiene que despertarse a
 * las 7:15 aunque nada más salga a esa hora.
 */
export function windowOf(
  fields: { weekdays: readonly number[]; startMinute: number; endMinute: number },
  items: readonly PlannedItem[] = [],
  fixedMinutes: readonly number[] = [],
): DailyWindow {
  return {
    weekdays: fields.weekdays,
    minutes: gridOf(items, fields.startMinute, fields.endMinute, fixedMinutes),
  };
}

/** Todos los minutos del día en los que el horario tiene algo que enviar. */
export function gridOf(
  items: readonly PlannedItem[],
  startMinute: number,
  endMinute: number,
  fixedMinutes: readonly number[] = [],
): number[] {
  const minutes = new Set<number>([
    ...minutesOf(planOf(items, startMinute, endMinute)),
    ...fixedMinutes,
  ]);

  // Sin nada que enviar el horario sigue vivo: mira a la hora de inicio para
  // volver a comprobar cuando alguien llene la biblioteca.
  if (minutes.size === 0) return [startMinute];

  return [...minutes].sort((left, right) => left - right);
}
