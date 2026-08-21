import type { DeliveryStatus, ItemKind } from './vocabulary';

/** Lo que hace falta saber del horario para poder despachar su envío. */
export interface DispatchTarget {
  readonly scheduleId: string;
  readonly libraryId: string;
  readonly ownerId: string;
  /** El chat de Telegram. Nulo si el destinatario dejó de estar vinculado. */
  readonly chatId: string | null;
  /** Con qué nombre firma. Ya resuelto: el del horario o el de la cuenta. */
  readonly senderName: string;
  readonly kindFilter: ItemKind | null;
  readonly startMinute: number;
  readonly endMinute: number;
  readonly timezone: string;
  /**
   * Las horas con un envío clavado, y qué sale en cada una.
   *
   * Viajan con el objetivo y no se consultan aparte porque hacen falta dos
   * veces en el mismo despacho: para saber si esta hora tiene dueño, y para
   * dejar fuera del reparto lo que ya tiene su hora.
   */
  readonly fixedItems: readonly { minute: number; itemId: string }[];
}

export interface ScheduleReader {
  find(scheduleId: string): Promise<DispatchTarget | null>;
  /** Apaga el horario y deja dicho por qué, para que el dueño lo entienda. */
  deactivate(scheduleId: string, reason: string): Promise<void>;
}

/** Un elemento listo para salir, ya con sus bytes o su texto. */
export interface Payload {
  readonly itemId: string;
  readonly kind: ItemKind;
  readonly fileName: string | null;
  readonly text: string | null;
  readonly storageKey: string | null;
}

export interface LibraryCatalog {
  /**
   * Qué elemento le toca a esa hora exacta, o `null` si no le toca a ninguno.
   *
   * No hay nada que elegir: el plan del día reparte los envíos de cada archivo
   * por la franja y a cada momento le corresponde uno. Lo clavado manda sobre
   * el plan, porque es una hora que el dueño reservó a mano.
   *
   * **Nunca devuelve nada del baúl.** El baúl es personal: lo que hay ahí no
   * sale hacia nadie hasta que su dueño lo copie a una biblioteca. La regla
   * vive en la consulta y no en quien llama, para que ningún camino nuevo pueda
   * saltársela por descuido.
   */
  itemAt(target: DispatchTarget, occurredAt: Date): Promise<string | null>;
  payloadOf(itemId: string): Promise<Payload | null>;
}

export interface MediaSource {
  /** Los bytes del objeto, para subirlos al proveedor. */
  bytesOf(storageKey: string): Promise<Uint8Array>;
}

/**
 * Un fallo del proveedor, ya clasificado.
 *
 * `permanent` es la distinción que importa: el bot bloqueado o un chat que no
 * existe no se arreglan reintentando, así que apagan el horario y avisan. Lo
 * demás es un mal momento de la red y se reintenta en la siguiente ocurrencia.
 */
export interface SendFailure {
  readonly permanent: boolean;
  readonly reason: string;
}

export interface SendResult {
  readonly messageId: string | null;
  readonly failure: SendFailure | null;
}

export interface MessageSender {
  send(
    chatId: string,
    payload: Payload,
    caption: string,
    bytes: Uint8Array | null,
  ): Promise<SendResult>;
}

/**
 * Le deja un aviso al dueño **dentro de la aplicación**.
 *
 * No por Telegram: el único chat que conocemos de una cuenta es el de sus
 * destinatarios, y esos son otras personas. Contarle a la madre de alguien que
 * a su hijo le falló un envío es contarle a un tercero cómo anda una cuenta
 * ajena.
 */
export interface NoticeWriter {
  write(ownerId: string, text: string): Promise<void>;
}

/** Una ocurrencia que fallo por algo pasajero y espera su siguiente intento. */
export interface PendingRetry {
  readonly scheduleId: string;
  readonly occurrenceKey: string;
  readonly occurredAt: Date;
  readonly retryCount: number;
  /**
   * El elemento que se eligió en el primer intento.
   *
   * Se guarda y no se vuelve a calcular: si alguien agregó un archivo entre
   * medias, el plan del día ya dice otra cosa, y lo que estaba a medio salir
   * era el de antes.
   */
  readonly itemId: string;
}

export interface DeliveryLog {
  /**
   * Reserva la ocurrencia. Devuelve `false` si ya estaba tomada.
   *
   * **Solo inserta.** Si la clave ya existe no toca la fila: quien la tomó
   * primero es el dueño del envío, y pisarle el resultado borraría lo que ya
   * había averiguado. La unicidad la decide el índice de la base y no una
   * consulta previa, que dos réplicas podrían pasar a la vez.
   */
  reserve(attempt: {
    scheduleId: string;
    itemId: string | null;
    occurrenceKey: string;
    occurredAt: Date;
    status: DeliveryStatus;
    error: string | null;
  }): Promise<boolean>;

  /** Anota en qué quedó la ocurrencia que ya estaba reservada. */
  settle(
    occurrenceKey: string,
    result: {
      status: DeliveryStatus;
      itemId?: string | null;
      providerMessageId?: string | null;
      error: string | null;
      retryCount?: number;
      nextAttemptAt?: Date | null;
    },
  ): Promise<void>;

  /**
   * Toma los reintentos vencidos y los deja tomados, igual que el calendario
   * hace con los horarios: bloquea las filas y se salta las que otro ya tenga.
   */
  claimDueRetries(now: Date, limit: number): Promise<PendingRetry[]>;

  /**
   * Cuántos envíos salieron **de verdad** desde ese instante, para toda la
   * cuenta. Es lo que hace cumplir el tope diario.
   *
   * Solo los `SENT`: lo que se saltó por el propio tope no puede contar para el
   * tope, o la cuenta quedaría bloqueada para siempre en cuanto lo tocara una
   * vez.
   */
  countSentSince(ownerId: string, since: Date): Promise<number>;

  recent(ownerId: string, limit: number): Promise<DeliveryRecord[]>;
}

/** Lo que la pantalla muestra de un aviso. */
export interface NoticeRecord {
  readonly id: string;
  readonly text: string;
  readonly createdAt: Date;
}

export interface NoticeReader {
  unreadOf(ownerId: string): Promise<NoticeRecord[]>;
  markRead(ownerId: string, noticeId: string): Promise<void>;
}

export interface DeliveryRecord {
  readonly id: string;
  readonly scheduleId: string;
  readonly libraryName: string;
  readonly recipientLabel: string;
  readonly status: DeliveryStatus;
  readonly error: string | null;
  readonly occurredAt: Date;
}

export const SCHEDULE_READER = Symbol('ScheduleReader');
export const LIBRARY_CATALOG = Symbol('LibraryCatalog');
export const MEDIA_SOURCE = Symbol('MediaSource');
export const MESSAGE_SENDER = Symbol('MessageSender');
export const DELIVERY_LOG = Symbol('DeliveryLog');
export const NOTICE_WRITER = Symbol('NoticeWriter');
export const NOTICE_READER = Symbol('NoticeReader');
