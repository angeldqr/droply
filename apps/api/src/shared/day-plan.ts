/** Un elemento de la biblioteca, con lo que hace falta para repartirlo. */
export interface PlannedItem {
  readonly id: string;
  /** Cuántas veces al día se manda. Al menos una. */
  readonly timesPerDay: number;
  /** Su orden en el tablero, que es lo que desempata a igualdad de hora. */
  readonly position: number;
}

/** Un envío del día: a este minuto sale este elemento. */
export interface PlannedSend {
  readonly minute: number;
  readonly itemId: string;
}

/**
 * El plan del día: qué sale y a qué hora, para toda la biblioteca.
 *
 * Cada archivo sale **exactamente** las veces que pidió, y cada envío tiene su
 * propio momento: nada se amontona y nada se pisa. Con un audio de tres veces,
 * un video de una, una imagen de tres y un texto de dos, salen nueve envíos
 * repartidos de 6:00 a 21:00 — no tres, y no nueve todos a las 6:00.
 *
 * El reparto va en dos pasos, y separarlos es lo que lo hace entendible:
 *
 * 1. **El orden.** A cada envío se le da su sitio dentro del día como una
 *    fracción: el j-ésimo de un archivo que sale n veces va en `(j + ½) / n`.
 *    El medio es lo que separa a dos archivos con el mismo número — sin él, un
 *    audio de tres veces y una imagen de tres veces pedirían las mismas horas
 *    exactas y habría que romper el empate a la fuerza. Con las fracciones
 *    ordenadas sale una secuencia intercalada sola: audio, imagen, texto,
 *    audio, video, imagen, texto, audio, imagen.
 *
 * 2. **Las horas.** Esa secuencia se estira sobre la franja de extremo a
 *    extremo, igual que se repartía antes un archivo solo: el primero a la hora
 *    de inicio, el último a la de fin, y el resto igualmente espaciados.
 *
 * A igualdad de fracción manda el orden del tablero, así que arrastrar una
 * tarjeta cambia a qué hora sale. Es la única forma que tiene el usuario de
 * decidirlo, y por eso no se desempata por identificador ni al azar.
 */
export function planOf(
  items: readonly PlannedItem[],
  startMinute: number,
  endMinute: number,
): PlannedSend[] {
  const sends = items
    .flatMap((item) => {
      const times = Math.max(1, Math.floor(item.timesPerDay));

      return Array.from({ length: times }, (_, index) => ({
        itemId: item.id,
        position: item.position,
        share: (index + 0.5) / times,
      }));
    })
    .sort((left, right) => left.share - right.share || left.position - right.position);

  if (sends.length === 0) return [];
  if (sends.length === 1) return [{ minute: startMinute, itemId: sends[0]?.itemId ?? '' }];

  const step = (endMinute - startMinute) / (sends.length - 1);
  const taken = new Set<number>();

  return sends.map((send, index) => ({
    minute: free(Math.round(startMinute + step * index), taken, endMinute),
    itemId: send.itemId,
  }));
}

/**
 * El primer minuto libre desde el que tocaba.
 *
 * Dos envíos solo caen en el mismo minuto cuando hay más envíos que minutos en
 * la franja —una franja de media hora con veinte archivos—, y ahí se corren uno
 * a uno hacia adelante.
 *
 * ponytail: si se pasan del fin de la franja se apilan en el último minuto, y
 * ese día algunos envíos no salen. Repartirlos hacia atrás pediría un segundo
 * recorrido para un caso que nadie ha configurado todavía.
 */
function free(ideal: number, taken: Set<number>, endMinute: number): number {
  let minute = ideal;

  while (taken.has(minute) && minute < endMinute) minute += 1;

  taken.add(minute);

  return minute;
}

/** Los minutos del plan, sin repetir y en orden: la rejilla del horario. */
export function minutesOf(plan: readonly PlannedSend[]): number[] {
  return [...new Set(plan.map((send) => send.minute))].sort((left, right) => left - right);
}
