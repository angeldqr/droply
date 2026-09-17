/**
 * Los botones de la bitácora y lo que viaja de vuelta al apretarlos.
 *
 * El prefijo `j:` es lo que separa estos toques de los `h:` de los votos de un
 * plan de hábitos. Los dos llegan por el mismo `callback_query`, y sin el
 * prefijo el manejador equivocado se quedaría con el toque del otro.
 */

/** Telegram corta el `callback_data` en 64 bytes y no avisa: manda el botón igual. */
export const CALLBACK_DATA_MAX_BYTES = 64;

const PREFIX = 'j';

/**
 * El comando que abre la bitácora.
 *
 * Copia del contrato: el núcleo no puede importarlo, y el guardián de
 * `limits.spec.ts` es lo único que impide que las dos se separen. Si se
 * separaran, el menú del bot ofrecería un comando que el bot no atiende.
 */
export const COMMAND = '/habits';

/** El que dice cómo va el día. Misma copia, mismo guardián. */
export const TODAY_COMMAND = '/hoy';

export interface ChatButton {
  readonly label: string;
  readonly data: string;
}

/** Lo que puede pedir un toque de la bitácora. */
export type ChatAction =
  | { readonly kind: 'PICK'; readonly habitId: string }
  | { readonly kind: 'DONE' }
  | { readonly kind: 'OFFER_MOVE' }
  | { readonly kind: 'MOVE'; readonly habitId: string };

/**
 * El botón de un hábito, numerado como pidió el cliente.
 *
 * `progress` es cómo va hoy («1/2», «✓»). Va solo en el texto, que no tiene el
 * tope de 64 bytes de `data`.
 */
export function pickButton(
  position: number,
  name: string,
  habitId: string,
  progress?: string,
): ChatButton {
  const label = `${position} · ${name}`;

  return {
    label: progress ? `${label} · ${progress}` : label,
    data: `${PREFIX}:p:${habitId}`,
  };
}

/** El botón que cierra la anotación. */
export function doneButton(): ChatButton {
  return { label: '✅ Listo', data: `${PREFIX}:d` };
}

/**
 * El botón que ofrece pasar la anotación a otro hábito.
 *
 * Sale cuando el bot abrió una anotación por su cuenta —porque la anterior
 * caducó— y puede haber adivinado mal de qué hábito era lo que llegó.
 */
export function offerMoveButton(): ChatButton {
  return { label: '↪ Era de otro hábito', data: `${PREFIX}:o` };
}

/** El botón de un hábito al que mover la anotación abierta. */
export function moveButton(position: number, name: string, habitId: string): ChatButton {
  return { label: `${position} · ${name}`, data: `${PREFIX}:m:${habitId}` };
}

export function parseChatAction(data: string): ChatAction | null {
  const parts = data.split(':');

  if (parts[0] !== PREFIX) return null;

  if (parts.length === 2 && parts[1] === 'd') return { kind: 'DONE' };

  if (parts.length === 2 && parts[1] === 'o') return { kind: 'OFFER_MOVE' };

  if (parts.length === 3 && (parts[1] === 'p' || parts[1] === 'm')) {
    const habitId = parts[2] ?? '';

    /*
     * El identificador viaja por un canal público: cualquiera puede mandar un
     * `callback_query` inventado. Que tenga forma de UUID no prueba nada —de eso
     * se encarga comprobar el chat—, pero corta la basura antes de la consulta.
     */
    if (!/^[0-9a-f-]{36}$/i.test(habitId)) return null;

    return { kind: parts[1] === 'p' ? 'PICK' : 'MOVE', habitId };
  }

  return null;
}
