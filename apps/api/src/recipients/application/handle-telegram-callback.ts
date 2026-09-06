import { HABIT_ACTION_LABELS, parseHabitAction } from '../../shared/habit-vote';
import type { HabitVoteOutcome, HabitVoteSink } from '../../shared/habit-vote-sink';
import type { CallbackResponder } from '../domain/ports';

/**
 * Lo que se ve arriba del chat al apretar un botón.
 *
 * Cuatro casos y cuatro frases, porque el silencio en un botón se lee como que
 * la aplicación está rota. `IGNORED` no dice por qué: cubre tanto un plan que
 * ya no existe como un toque desde un chat que no es el del destinatario, y
 * distinguirlos dejaría probar identificadores a ciegas.
 */
const REPLIES: Readonly<Record<HabitVoteOutcome, string>> = {
  RECORDED: 'Anotado.',
  ALREADY: 'Ya habías respondido a este.',
  CLOSED: 'Ese día ya cerró.',
  IGNORED: 'Este ya no se puede responder.',
};

/**
 * Atiende el toque de un botón de un plan de hábitos.
 *
 * Vive en `application` por lo mismo que su hermano de los mensajes: hay dos
 * puertas —el webhook en producción y el sondeo largo en desarrollo— y las dos
 * traducen la carga cruda a esta forma y llaman a lo mismo, así que no hay dos
 * versiones de la votación.
 *
 * Este contexto **no sabe nada de planes**: cuenta quién apretó qué y se lo
 * pasa al sumidero. Quien decide si cuenta es `habits`, del otro lado.
 */
export class HandleTelegramCallback {
  constructor(
    private readonly votes: HabitVoteSink,
    private readonly chat: CallbackResponder,
  ) {}

  async execute(callback: {
    chatId: string;
    callbackId: string;
    messageId: number | null;
    data: string;
  }): Promise<void> {
    const action = parseHabitAction(callback.data);

    /*
     * Un dato que no reconocemos igual se acusa, y con una cadena vacía para no
     * enseñar nada. Es el caso del botón inerte que queda tras votar: sin este
     * acuse, tocarlo dejaría el reloj girando en el teléfono de la persona.
     */
    if (!action) {
      await this.chat.answer(callback.callbackId, '');

      return;
    }

    const outcome = await this.votes.cast({
      deliveryId: action.deliveryId,
      chatId: callback.chatId,
      answer: action.answer,
    });

    await this.chat.answer(callback.callbackId, REPLIES[outcome]);

    if (outcome !== 'RECORDED' || callback.messageId === null) return;

    // Se sustituyen los tres botones por uno solo con lo que eligió: así la
    // respuesta queda a la vista en el chat y no hay nada más que tocar.
    await this.chat.lock(
      callback.chatId,
      callback.messageId,
      `✔ ${HABIT_ACTION_LABELS[action.answer].slice(2)}`,
    );
  }
}
