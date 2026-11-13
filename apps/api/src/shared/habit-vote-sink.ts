import type { HabitAnswer } from './habit-vote';

/**
 * El toque de un botón, camino de quien lleva la cuenta.
 *
 * Es la costura entre dos contextos, igual que `OccurrenceSink`: `recipients`
 * tiene la puerta del bot y sabe traducir lo que llega de Telegram, pero no
 * sabe nada de planes; `habits` lleva la cuenta pero no habla con Telegram. El
 * contrato que los une vive acá porque es el único sitio que los dos ven.
 */
export interface HabitVote {
  readonly deliveryId: string;
  /** El chat desde el que se apretó. Es lo que prueba quién está votando. */
  readonly chatId: string;
  readonly answer: HabitAnswer;
}

/**
 * En qué quedó el toque.
 *
 * - `RECORDED`: anotado, y ya no se puede cambiar.
 * - `ALREADY`: ese envío ya se había votado.
 * - `CLOSED`: el día ya cerró su cuenta, así que llega tarde.
 * - `ENDED`: lo toca el destinatario, pero el envío ya no es de un plan vivo.
 * - `IGNORED`: el chat no es el del destinatario, o el envío no existe.
 */
export type HabitVoteOutcome = 'RECORDED' | 'ALREADY' | 'CLOSED' | 'ENDED' | 'IGNORED';

export interface HabitVoteSink {
  cast(vote: HabitVote): Promise<HabitVoteOutcome>;
}

export const HABIT_VOTE_SINK = Symbol('HabitVoteSink');
