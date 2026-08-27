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

/** Una hora clavada: a esta hora sale este archivo y ningún otro. */
export interface FixedSlot {
  readonly minute: number;
  readonly itemId: string;
}

/**
 * El día entero de un horario: lo clavado más el reparto, ordenado por hora.
 *
 * **Esta es la única función que decide qué sale y cuándo.** La rejilla de
 * `gridOf` son sus minutos, el despacho de `itemAt` busca en ella, y la vista
 * previa la enseña tal cual. Estaba escrita dos veces —una en cada sitio— y las
 * dos copias llegaron a discrepar: la rejilla repartía con los clavados dentro
 * del pool y el despacho los excluía, así que el horario se despertaba a horas
 * en las que no había nada y callaba en horas en las que sí.
 *
 * **Una hora clavada es una de las veces del archivo, no un sustituto.** Un
 * archivo de tres veces al día clavado a las 6:00 sale a las 6:00 y dos veces
 * más repartidas por el resto del día. Antes lo clavado sacaba al archivo del
 * reparto y sus veces al día se perdían, así que quien clavaba los cuatro
 * archivos de su biblioteca se quedaba con cuatro envíos y ninguna forma de
 * pedir más.
 *
 * El truco que lo hace funcionar está en el paso 2: **cada hora clavada consume
 * la parte del día a la que se parece**, no una cualquiera. Clavar a las 6:00 en
 * una franja de 6:00 a 21:00 gasta la primera de las tres salidas, así que las
 * otras dos quedan por el medio y el final. Si consumiera una del medio, el
 * archivo saldría dos veces casi seguidas al principio.
 *
 * Sin ninguna hora clavada esto devuelve exactamente lo mismo que `planOf`:
 * todas las salidas quedan libres y el reparto es el de siempre.
 */
export function dayOf(
  items: readonly PlannedItem[],
  startMinute: number,
  endMinute: number,
  fixed: readonly FixedSlot[] = [],
): PlannedSend[] {
  const span = Math.max(1, endMinute - startMinute);
  const pins = new Map<string, number[]>();

  for (const slot of fixed) {
    pins.set(slot.itemId, [...(pins.get(slot.itemId) ?? []), slot.minute]);
  }

  /*
   * Un archivo puede estar clavado y no aparecer en el reparto: el horario que
   * filtra por una columna deja fuera a los demás. Entra con cero veces, así
   * que sus horas clavadas salen y no se le inventa ninguna más.
   */
  const conocidos = new Set(items.map((item) => item.id));
  const soloClavados = [...pins.keys()]
    .filter((itemId) => !conocidos.has(itemId))
    .map((itemId) => ({ id: itemId, timesPerDay: 0, position: Number.MAX_SAFE_INTEGER }));

  const libres: { itemId: string; position: number; share: number }[] = [];

  for (const item of [...items, ...soloClavados]) {
    const suyas = [...(pins.get(item.id) ?? [])].sort((left, right) => left - right);
    const veces = Math.max(1, Math.floor(item.timesPerDay), suyas.length);
    const shares = Array.from({ length: veces }, (_, index) => (index + 0.5) / veces);
    const gastadas = new Set<number>();

    // Paso 2: cada hora clavada se queda con la parte del día más parecida.
    for (const minute of suyas) {
      const donde = (minute - startMinute) / span;
      let elegida = -1;
      let cerca = Infinity;

      for (let index = 0; index < veces; index += 1) {
        if (gastadas.has(index)) continue;

        const distancia = Math.abs((shares[index] ?? 0) - donde);

        if (distancia < cerca) {
          cerca = distancia;
          elegida = index;
        }
      }

      if (elegida >= 0) gastadas.add(elegida);
    }

    for (let index = 0; index < veces; index += 1) {
      if (gastadas.has(index)) continue;

      libres.push({ itemId: item.id, position: item.position, share: shares[index] ?? 0 });
    }
  }

  libres.sort((left, right) => left.share - right.share || left.position - right.position);

  /*
   * Paso 4: los huecos se calculan contando **todos** los envíos del día, los
   * clavados incluidos, y cada hora clavada se queda con el hueco más cercano.
   *
   * Repartir solo los libres sobre la franja entera los mandaba a los extremos,
   * que es justo donde suele haber algo clavado: con una hora fija a las 6:00 y
   * otra a las 21:00 —el principio y el final de la franja— el primer libre
   * pedía las 6:00, chocaba y se corría a las 6:01. Dos envíos con un minuto de
   * diferencia y luego dos horas de nada.
   */
  const total = libres.length + fixed.length;
  const huecos = evenly(total, startMinute, endMinute);
  const gastados = new Set<number>();

  for (const slot of fixed) {
    let elegido = -1;
    let cerca = Infinity;

    for (let index = 0; index < total; index += 1) {
      if (gastados.has(index)) continue;

      const distancia = Math.abs((huecos[index] ?? startMinute) - slot.minute);

      if (distancia < cerca) {
        cerca = distancia;
        elegido = index;
      }
    }

    if (elegido >= 0) gastados.add(elegido);
  }

  const taken = new Set(fixed.map((slot) => slot.minute));
  const disponibles = huecos.filter((_, index) => !gastados.has(index));

  return [
    ...fixed.map((slot) => ({ minute: slot.minute, itemId: slot.itemId })),
    ...libres.map((send, index) => ({
      minute: free(disponibles[index] ?? startMinute, taken, startMinute, endMinute),
      itemId: send.itemId,
    })),
  ].sort((left, right) => left.minute - right.minute);
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
  /**
   * Minutos que ya tienen dueño y el reparto no puede pisar: las horas
   * clavadas. Sin esto, un envío automático que cayera justo en una hora
   * clavada se perdía sin dejar rastro, porque a esa hora manda lo clavado.
   */
  reserved: readonly number[] = [],
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

  const minutes = spread(sends.length, startMinute, endMinute, new Set<number>(reserved));

  return sends.map((send, index) => ({
    minute: minutes[index] ?? startMinute,
    itemId: send.itemId,
  }));
}

/**
 * Los huecos para `count` envíos, de extremo a extremo de la franja.
 *
 * El primero a la hora de inicio, el último a la de fin y el resto igualmente
 * espaciados. Es el cálculo pelado: no mira quién está ocupado ni resuelve
 * choques, para que `dayOf` pueda repartir los huecos antes de asignarlos.
 */
function evenly(count: number, startMinute: number, endMinute: number): number[] {
  if (count === 0) return [];
  if (count === 1) return [startMinute];

  const step = (endMinute - startMinute) / (count - 1);

  return Array.from({ length: count }, (_, index) => Math.round(startMinute + step * index));
}

/**
 * Los mismos huecos, ya resueltos los choques con lo que estuviera ocupado.
 *
 * `taken` entra con los minutos que ya tienen dueño y sale con todos los
 * repartidos, para que dos envíos no caigan encima.
 */
function spread(
  count: number,
  startMinute: number,
  endMinute: number,
  taken: Set<number>,
): number[] {
  return evenly(count, startMinute, endMinute).map((minute) =>
    free(minute, taken, startMinute, endMinute),
  );
}

/**
 * El primer minuto libre desde el que tocaba.
 *
 * Se busca hacia adelante y, si la franja se acaba, hacia atrás. Lo segundo no
 * es un adorno desde que una hora clavada puede caer en el último minuto de la
 * franja: clavar algo a las 21:00 cuando la franja termina a las 21:00 es lo más
 * normal del mundo, y sin la vuelta hacia atrás el envío que quisiera ese minuto
 * se apilaba encima del clavado y no salía.
 *
 * Solo hace falta cuando hay más envíos que minutos libres, o cuando el ideal
 * cae justo sobre una hora que ya tiene dueño.
 */
function free(ideal: number, taken: Set<number>, startMinute: number, endMinute: number): number {
  let minute = ideal;

  while (minute <= endMinute && taken.has(minute)) minute += 1;

  if (minute > endMinute) {
    minute = ideal;

    while (minute >= startMinute && taken.has(minute)) minute -= 1;

    // La franja entera está ocupada: no queda más que apilarlo donde tocaba.
    if (minute < startMinute) return ideal;
  }

  taken.add(minute);

  return minute;
}

/** Los minutos del plan, sin repetir y en orden: la rejilla del horario. */
export function minutesOf(plan: readonly PlannedSend[]): number[] {
  return [...new Set(plan.map((send) => send.minute))].sort((left, right) => left - right);
}
