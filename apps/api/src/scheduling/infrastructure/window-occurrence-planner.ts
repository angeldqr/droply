import { DateTime } from 'luxon';
import type { DailyWindow, OccurrencePlanner } from '../domain/ports';

/**
 * Cuántos días se miran hacia adelante antes de rendirse.
 *
 * Con al menos un día de la semana elegido, la próxima ocurrencia cae dentro de
 * siete; el doble deja margen sin que el bucle pueda irse de las manos.
 */
const HORIZON_DAYS = 14;

/**
 * La próxima hora de envío, respetando la zona horaria de verdad.
 *
 * Todo el cálculo se hace en hora local —qué día de la semana es, y qué minuto
 * del día— y solo al final se convierte al instante real. Ese orden es lo que
 * hace que "los lunes a las 8" siga siendo a las 8 en enero y en julio, aunque
 * el desfase con UTC cambie en medio.
 *
 * Los dos días raros del año los resuelve Luxon, y por eso el cálculo pasa por
 * `DateTime.fromObject` y no por `new Date(...)`:
 *
 * - **La hora que no existe.** El día que los relojes adelantan, las 2:30 no
 *   ocurren. Luxon la corre a las 3:30, que es lo que espera quien programó un
 *   envío "de madrugada": llega un poco más tarde, no desaparece.
 * - **La hora que ocurre dos veces.** El día que atrasan, las 2:30 pasan dos
 *   veces. Luxon se queda con la primera, así que el envío sale una sola vez.
 */
export class WindowOccurrencePlanner implements OccurrencePlanner {
  nextAfter(window: DailyWindow, timezone: string, after: Date): Date | null {
    const from = DateTime.fromJSDate(after, { zone: timezone });

    // Una zona que no existe o una rejilla vacía no tienen próxima ocurrencia,
    // que es exactamente lo que `null` significa para quien llama.
    if (!from.isValid || window.weekdays.length === 0 || window.minutes.length === 0) return null;

    const days = new Set(window.weekdays);
    const minutes = [...new Set(window.minutes)].sort((left, right) => left - right);

    for (let offset = 0; offset < HORIZON_DAYS; offset += 1) {
      const day = from.startOf('day').plus({ days: offset });

      if (!days.has(day.weekday)) continue;

      for (const minute of minutes) {
        const candidate = DateTime.fromObject(
          {
            year: day.year,
            month: day.month,
            day: day.day,
            hour: Math.floor(minute / 60),
            minute: minute % 60,
          },
          { zone: timezone },
        );

        if (!candidate.isValid) continue;

        // Estrictamente después: si no, un horario que acaba de dispararse
        // volvería a elegir el mismo instante y se quedaría en bucle.
        if (candidate.toMillis() > after.getTime()) return candidate.toJSDate();
      }
    }

    return null;
  }
}
