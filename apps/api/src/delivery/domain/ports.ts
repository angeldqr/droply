import type { Candidate } from './selection';
import type { DeliveryStatus, ItemKind, SelectionStrategy } from './vocabulary';

/** Lo que hace falta saber del horario para poder despachar su envío. */
export interface DispatchTarget {
  readonly scheduleId: string;
  readonly libraryId: string;
  readonly ownerId: string;
  /** El chat de Telegram. Nulo si el destinatario dejó de estar vinculado. */
  readonly chatId: string | null;
  /** Con qué nombre firma. Ya resuelto: el del horario o el de la cuenta. */
  readonly senderName: string;
  readonly strategy: SelectionStrategy;
  readonly kindFilter: ItemKind | null;
  readonly startMinute: number;
  readonly endMinute: number;
  readonly timezone: string;
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
   * Los elementos que a esa hora del día les toca salir.
   *
   * **Nunca devuelve nada del baúl.** El baúl es personal: lo que hay ahí no
   * sale hacia nadie hasta que su dueño lo copie a una biblioteca. La regla
   * vive en la consulta y no en quien llama, para que ningún camino nuevo pueda
   * saltársela por descuido.
   */
  candidatesOf(target: DispatchTarget, occurredAt: Date): Promise<Candidate[]>;
  payloadOf(itemId: string): Promise<Payload | null>;
}

/** La bolsa del "sin repetir": qué ya salió por este horario. */
export interface SentBag {
  idsOf(scheduleId: string): Promise<string[]>;
  add(scheduleId: string, itemId: string): Promise<void>;
  clear(scheduleId: string): Promise<void>;
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
  /** Un aviso al dueño cuando su horario se apaga solo. */
  notifyOwner(ownerId: string, text: string): Promise<void>;
}

export interface DeliveryLog {
  /**
   * Registra el intento. Devuelve `false` si esa ocurrencia ya estaba anotada,
   * que es como se evita mandar dos veces lo mismo: la unicidad la decide el
   * índice de la base, no una consulta previa que dos réplicas podrían pasar a
   * la vez.
   */
  record(attempt: {
    scheduleId: string;
    itemId: string | null;
    occurrenceKey: string;
    occurredAt: Date;
    status: DeliveryStatus;
    providerMessageId: string | null;
    error: string | null;
  }): Promise<boolean>;
  recent(ownerId: string, limit: number): Promise<DeliveryRecord[]>;
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
export const SENT_BAG = Symbol('SentBag');
export const MEDIA_SOURCE = Symbol('MediaSource');
export const MESSAGE_SENDER = Symbol('MessageSender');
export const DELIVERY_LOG = Symbol('DeliveryLog');
export const RANDOMNESS = Symbol('Randomness');
