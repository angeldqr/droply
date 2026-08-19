/**
 * Qué elemento sale en este envío.
 *
 * Las tres estrategias son funciones puras sobre una lista ya filtrada: nadie
 * consulta la base desde acá, y por eso se pueden probar con listas escritas a
 * mano en vez de con un mundo entero montado.
 */
export type SelectionStrategy = 'RANDOM' | 'RANDOM_NO_REPEAT' | 'SEQUENTIAL';

export interface Candidate {
  readonly id: string;
  /** El orden dentro de su columna, que es el que ve el usuario en el tablero. */
  readonly position: number;
  readonly kind: string;
}

/** Para poder fijar el azar en los tests sin tocar `Math.random`. */
export interface Randomness {
  pick(count: number): number;
}

export const systemRandomness: Randomness = {
  pick: (count) => Math.floor(Math.random() * count),
};

/**
 * Elige uno entre los candidatos.
 *
 * `alreadySent` es la bolsa del "aleatorio sin repetir": los que ya salieron por
 * este horario. Cuando la bolsa cubre todo lo que hay, se vacía y se vuelve a
 * empezar — si no, un horario dejaría de enviar para siempre en cuanto
 * recorriera la biblioteca entera.
 *
 * Devuelve `null` solo cuando no hay nada que enviar.
 */
export function selectOne(
  strategy: SelectionStrategy,
  candidates: readonly Candidate[],
  alreadySent: ReadonlySet<string>,
  random: Randomness,
): { chosen: Candidate; resetBag: boolean } | null {
  if (candidates.length === 0) return null;

  if (strategy === 'SEQUENTIAL') {
    /*
     * En orden: el siguiente al último que salió. La bolsa hace de marcador de
     * posición, así que "en orden" y "sin repetir" comparten estructura y no
     * hacen falta dos columnas para lo mismo.
     */
    const ordered = [...candidates].sort(byPosition);
    const next = ordered.find((candidate) => !alreadySent.has(candidate.id));

    if (next) return { chosen: next, resetBag: false };

    // Se dio la vuelta entera: vuelve a empezar por el primero.
    return { chosen: ordered[0]!, resetBag: true };
  }

  if (strategy === 'RANDOM_NO_REPEAT') {
    const pending = candidates.filter((candidate) => !alreadySent.has(candidate.id));

    if (pending.length > 0) {
      return { chosen: pending[random.pick(pending.length)]!, resetBag: false };
    }

    // La bolsa cubría todo: se vacía y se elige entre todos otra vez.
    return { chosen: candidates[random.pick(candidates.length)]!, resetBag: true };
  }

  // Al azar a secas: puede repetir antes de recorrerla entera, y está dicho así
  // en la propia pantalla al elegir la estrategia.
  return { chosen: candidates[random.pick(candidates.length)]!, resetBag: false };
}

function byPosition(left: Candidate, right: Candidate): number {
  return left.position - right.position || left.id.localeCompare(right.id);
}
