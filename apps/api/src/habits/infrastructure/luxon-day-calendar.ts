import { DateTime } from 'luxon';
import type { CivilDay } from '../domain/civil-day';
import type { DayCalendar } from '../domain/ports';

/**
 * La traducción entre instantes y días civiles, con la base de zonas del
 * sistema.
 *
 * Vive en infraestructura porque el núcleo es TypeScript pelado y esto necesita
 * saber que Bogotá va a menos cinco y que Santiago cambia de hora en septiembre
 * — el mismo motivo por el que `scheduling` tiene su `OccurrencePlanner`.
 */
export class LuxonDayCalendar implements DayCalendar {
  dayAt(moment: Date, timezone: string): CivilDay {
    return DateTime.fromJSDate(moment, { zone: timezone }).toISODate() ?? '';
  }

  /**
   * Los dos extremos del día, en UTC. El final es el arranque del siguiente,
   * y quien consulta lo trata como exclusivo: así la medianoche exacta cae en
   * un solo día en vez de contarse dos veces.
   *
   * `startOf('day')` sobre la zona, y no medianoche a mano: hay días en los que
   * la medianoche **no existe** —Santiago adelanta el reloj a esa hora en
   * septiembre— y Luxon devuelve entonces la una, que es cuando ese día
   * empieza de verdad. Restar veinticuatro horas al día siguiente daría una
   * hora de más o de menos dos veces al año, y el error se vería como un envío
   * contado en el día equivocado.
   */
  boundsOf(day: CivilDay, timezone: string): { from: Date; to: Date } {
    const start = DateTime.fromISO(day, { zone: timezone }).startOf('day');

    return {
      from: start.toJSDate(),
      to: start.plus({ days: 1 }).startOf('day').toJSDate(),
    };
  }
}
