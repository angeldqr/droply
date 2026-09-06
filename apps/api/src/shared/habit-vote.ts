/**
 * Los botones que acompañan a un envío dentro de un plan de hábitos, y cómo se
 * lee la respuesta cuando alguien aprieta uno.
 *
 * Vive en `shared` porque hacen falta en dos contextos que no pueden verse
 * entre sí: `delivery` los pega al mensaje que sale, y `recipients` los
 * descifra cuando el toque vuelve por el bot. Escribir el formato dos veces es
 * exactamente la clase de cosa que se desincroniza en silencio —los botones
 * seguirían apareciendo y ninguna respuesta se contaría—.
 */

/** Las tres respuestas posibles. Copia del vocabulario del contrato. */
export const HABIT_ANSWERS = ['DONE', 'HALF', 'MISSED'] as const;

export type HabitAnswer = (typeof HABIT_ANSWERS)[number];

export function isHabitAnswer(value: string): value is HabitAnswer {
  return (HABIT_ANSWERS as readonly string[]).includes(value);
}

/** Un botón: lo que se lee y lo que viaja de vuelta al apretarlo. */
export interface ChatAction {
  readonly label: string;
  readonly data: string;
}

/**
 * Telegram corta el `callback_data` en 64 bytes y no avisa: manda el botón
 * igual y el toque llega mutilado. Con `h:` + un UUID + `:` + una letra son 40,
 * así que hay margen de sobra, pero la constante queda para que el día que
 * alguien alargue el formato el test lo diga.
 */
export const CALLBACK_DATA_MAX_BYTES = 64;

const PREFIX = 'h';

/**
 * Una letra por respuesta en vez del nombre entero, para que quepa el UUID.
 *
 * Es un mapa explícito y no la inicial calculada: `DONE` y nada más empiezan
 * distinto hoy, pero una respuesta nueva que chocara de inicial rompería las
 * votaciones ya enviadas, que siguen vivas en los chats de la gente.
 */
const CODES: Readonly<Record<HabitAnswer, string>> = {
  DONE: 'D',
  HALF: 'H',
  MISSED: 'M',
};

const ANSWERS: Readonly<Record<string, HabitAnswer>> = {
  D: 'DONE',
  H: 'HALF',
  M: 'MISSED',
};

/**
 * Las etiquetas que ve quien recibe el envío.
 *
 * Son las tres que pidió el cliente, en ese orden. El emoji va delante porque
 * en el teclado de Telegram es lo único que se distingue de reojo.
 */
export const HABIT_ACTION_LABELS: Readonly<Record<HabitAnswer, string>> = {
  DONE: '✅ Realizado',
  HALF: '🟡 50%',
  MISSED: '❌ No cumplido',
};

/** El teclado de un envío que forma parte de un plan. */
export function habitActions(deliveryId: string): readonly ChatAction[] {
  return HABIT_ANSWERS.map((answer) => ({
    label: HABIT_ACTION_LABELS[answer],
    data: `${PREFIX}:${deliveryId}:${CODES[answer]}`,
  }));
}

/** El envío y la respuesta que trae un toque, o `null` si no es de los nuestros. */
export function parseHabitAction(
  data: string,
): { readonly deliveryId: string; readonly answer: HabitAnswer } | null {
  const parts = data.split(':');

  if (parts.length !== 3 || parts[0] !== PREFIX) return null;

  const deliveryId = parts[1] ?? '';
  const answer = ANSWERS[parts[2] ?? ''];

  // El identificador viaja por un canal público: cualquiera puede mandar un
  // `callback_query` inventado. Que tenga forma de UUID no prueba nada —de eso
  // se encarga comprobar el chat—, pero corta la basura antes de la consulta.
  if (!answer || !/^[0-9a-f-]{36}$/i.test(deliveryId)) return null;

  return { deliveryId, answer };
}
