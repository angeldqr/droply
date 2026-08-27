import { dayOf, minutesOf, type FixedSlot, type PlannedItem } from '../../shared/day-plan';
import type { DailyWindow } from './ports';

export type { FixedSlot };

/**
 * La ventana lista para el planificador, a partir de los campos del horario.
 *
 * La rejilla —las horas a las que el horario tiene que despertarse— sale del
 * plan del día: cada elemento aporta tantos momentos como veces al día pida, y
 * todos se intercalan dentro de la franja.
 *
 * `fixed` son los envíos clavados. Sus horas entran aunque el plan no las pise:
 * si alguien pide algo a las 7:15, el horario tiene que despertarse a las 7:15
 * aunque nada más salga a esa hora.
 *
 * **La rejilla tiene que calcular el mismo plan que el despacho**, o el horario
 * se despierta a horas en las que no hay nada y calla en las que sí. Por eso
 * acá se repiten las dos reglas que aplica `itemAt`: lo clavado sale del pool
 * —tiene hora propia y no cuenta para sus veces al día— y sus minutos quedan
 * reservados para que el reparto no los pise.
 */
export function windowOf(
  fields: { weekdays: readonly number[]; startMinute: number; endMinute: number },
  items: readonly PlannedItem[] = [],
  fixed: readonly FixedSlot[] = [],
): DailyWindow {
  return {
    weekdays: fields.weekdays,
    minutes: gridOf(items, fields.startMinute, fields.endMinute, fixed),
  };
}

/**
 * Todos los minutos del día en los que el horario tiene algo que enviar.
 *
 * Son exactamente los del día que arma `dayOf`, y por eso esta función es una
 * línea: cualquier regla que se escribiera acá sería una segunda opinión sobre
 * lo que ya decidió aquella, y las segundas opiniones se desincronizan.
 */
export function gridOf(
  items: readonly PlannedItem[],
  startMinute: number,
  endMinute: number,
  fixed: readonly FixedSlot[] = [],
): number[] {
  const minutes = minutesOf(dayOf(items, startMinute, endMinute, fixed));

  // Sin nada que enviar el horario sigue vivo: mira a la hora de inicio para
  // volver a comprobar cuando alguien llene la biblioteca.
  return minutes.length === 0 ? [startMinute] : minutes;
}
