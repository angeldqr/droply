/**
 * Lo que llega por el bot, camino de la bitácora.
 *
 * Es la costura entre dos contextos, igual que `OccurrenceSink` y
 * `HabitVoteSink`: `recipients` tiene la puerta del bot y sabe traducir lo que
 * manda Telegram, pero no sabe nada de hábitos; `journal` lleva la bitácora
 * pero no habla con la puerta. El contrato que los une vive acá porque es el
 * único sitio que los dos ven.
 *
 * **Los dos métodos devuelven un booleano, y ese booleano es todo el
 * protocolo:** `true` significa «me hice cargo, no sigas», `false` significa
 * «esto no es mío». Así la bitácora tiene primera opción sobre cada mensaje sin
 * que el camino de los destinatarios cambie ni una línea.
 */

/**
 * Una foto entrante, todavía sin bajar.
 *
 * Solo identificadores: lo que Telegram dice que pesa no sirve de nada, porque
 * el techo se aplica sobre los bytes que llegan de verdad.
 */
export interface InboundPhoto {
  /** La versión más grande, que es la que se guarda. */
  readonly fileId: string;
  /**
   * Una versión mediana para las rejillas. Telegram ya la manda hecha, así que
   * las miniaturas salen sin procesar ninguna imagen en el servidor.
   */
  readonly thumbFileId: string;
}

export interface InboundMessage {
  readonly chatId: string;
  readonly text: string | null;
  /**
   * La foto, si la trae.
   *
   * Opcional y no obligatorio: el parser siempre la pone, pero quien arma un
   * mensaje a mano —los tests— no tiene por qué nombrarla para decir que no
   * hay ninguna.
   */
  readonly photo?: InboundPhoto | null;
}

export interface InboundTap {
  readonly chatId: string;
  /** Hay que acusarlo sí o sí, o el botón se queda girando en el teléfono. */
  readonly callbackId: string;
  /** El mensaje que llevaba el teclado, para poder cambiárselo. */
  readonly messageId: number | null;
  readonly data: string;
}

export interface JournalInbox {
  handle(message: InboundMessage): Promise<boolean>;
  tap(tap: InboundTap): Promise<boolean>;
}

export const JOURNAL_INBOX = Symbol('JournalInbox');
