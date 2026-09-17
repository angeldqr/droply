import type { HabitEntryId, HabitId, PhotoId, UserId } from '../../shared/identifiers';
import type { AccountChat } from './account-chat';
import type { HabitEntry } from './entry';
import type { Habit } from './habit';

export interface HabitRepository {
  add(habit: Habit): Promise<void>;
  save(habit: Habit): Promise<void>;
  /** El dueño va en la firma y llega hasta el `where`, como en todo el repositorio. */
  findOwned(id: HabitId, ownerId: UserId): Promise<Habit | null>;
  listOwnedBy(ownerId: UserId): Promise<Habit[]>;
  countOwnedBy(ownerId: UserId): Promise<number>;
  lastPositionOf(ownerId: UserId): Promise<number | null>;
  remove(id: HabitId, ownerId: UserId): Promise<void>;
  /** Cuántas anotaciones tiene cada hábito y cuándo fue la última. */
  statsOf(ownerId: UserId): Promise<Map<HabitId, { count: number; lastAt: Date }>>;
  /** Guarda los tramos en pausa. Aparte de `save`: editar el hábito no los toca. */
  savePauses(habit: Habit): Promise<void>;
  /** La zona IANA de la cuenta: donde se cortan los días. */
  timezoneOf(ownerId: UserId): Promise<string>;
}

/** Una foto ya guardada, tal como la pinta la pantalla. */
export interface StoredPhoto {
  readonly id: PhotoId;
  readonly storageKey: string;
  readonly thumbKey: string | null;
}

/** Las anotaciones de cada hábito por día, cortadas en la zona de la cuenta. */
export interface DayCounts {
  /** Hoy en la zona de la cuenta, `AAAA-MM-DD`. */
  readonly today: string;
  /** Hábito → día → cuántas anotaciones no vacías. Los días sin nada no están. */
  readonly counts: ReadonlyMap<HabitId, ReadonlyMap<string, number>>;
}

export interface EntryRepository {
  add(entry: HabitEntry): Promise<void>;
  /**
   * Guarda una corregida desde la pantalla: el texto y el día también.
   *
   * Aparte de `save` porque aquella deja la nota fuera a propósito —la escribe
   * el bot en la base— y acá el texto es justo lo que se está cambiando. Lo que
   * se corrige queda cerrado, así que no hay nada llegando a la vez.
   */
  saveCorrection(entry: HabitEntry): Promise<void>;
  /** Las anotaciones de los últimos `days` días, hoy incluido. */
  dayCountsOf(ownerId: UserId, now: Date, days: number): Promise<DayCounts>;
  save(entry: HabitEntry): Promise<void>;
  /**
   * La anotación abierta de ese chat **y de ese dueño**.
   *
   * Es la consulta que sostiene toda la conversación. Lo que garantiza que haya
   * como mucho una es un índice único parcial sobre `(chat_id) WHERE closed_at
   * IS NULL`, no una comprobación previa.
   *
   * El dueño va en la firma por la misma regla que el resto del repositorio, y
   * acá además tapa un agujero concreto: un chat puede cambiar de cuenta
   * —alguien desconecta y otro vincula el mismo Telegram— y sin el dueño, lo
   * que escribiera el segundo caería en la anotación que dejó abierta el
   * primero.
   */
  findOpenFor(chatId: string, ownerId: UserId): Promise<HabitEntry | null>;
  listOf(habitId: HabitId, ownerId: UserId): Promise<HabitEntry[]>;
  findOwned(id: HabitEntryId, ownerId: UserId): Promise<HabitEntry | null>;
  remove(id: HabitEntryId, ownerId: UserId): Promise<void>;
  /**
   * Las fotos de esas anotaciones, para poder firmar sus enlaces.
   *
   * Con el dueño dentro del `where`, como el resto del repositorio: que quien
   * llama lo haya comprobado antes es justo el patrón que la regla prohíbe.
   */
  photosOf(
    ownerId: UserId,
    entryIds: readonly HabitEntryId[],
  ): Promise<Map<HabitEntryId, StoredPhoto[]>>;
  /**
   * Guarda la foto y devuelve cuántas tiene ya la anotación.
   *
   * El recuento sale de la base y no de la memoria porque las fotos de un álbum
   * llegan como mensajes distintos y a la vez: dos que leyeran la misma
   * anotación verían el mismo número y el tope se podría rebasar.
   */
  addPhoto(input: {
    id: PhotoId;
    ownerId: UserId;
    entryId: HabitEntryId;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
    thumbKey: string | null;
    /** Cuándo llegó: la foto también mantiene viva la anotación. */
    now: Date;
  }): Promise<number>;
  /**
   * Añade texto a la nota **en la base**, sin leerla antes.
   *
   * Es un `UPDATE` que concatena sobre lo que haya, y por eso dos mensajes
   * simultáneos no se pisan. Hacerlo en memoria —leer, juntar, guardar— perdía
   * uno de los dos cuando llegaban juntos.
   */
  appendNote(id: HabitEntryId, ownerId: UserId, text: string, now: Date): Promise<void>;
}

export interface AccountChatRepository {
  find(userId: UserId): Promise<AccountChat | null>;
  /** Por el hash del código, que es lo único que trae quien abre el enlace. */
  findByCodeHash(codeHash: string): Promise<AccountChat | null>;
  /**
   * De qué cuenta es ese chat.
   *
   * **Sin dueño en la firma, y es la única del contexto que puede permitírselo:**
   * quien escribe por el bot todavía no tiene sesión, y justamente lo que se
   * está preguntando es quién es. El índice único sobre `chat_id` garantiza que
   * la respuesta sea una sola. Todo lo que viene después de resolver la cuenta
   * sí lleva el dueño dentro del `where`.
   */
  findByChatId(chatId: string): Promise<AccountChat | null>;
  save(chat: AccountChat): Promise<void>;
}

/**
 * El código que viaja en el enlace: el valor en claro, que solo se ve una vez, y
 * el hash, que es lo único que se guarda.
 *
 * Mismo contrato que el de los destinatarios, y a propósito: el `start` de
 * Telegram admite 64 caracteres del juego `A-Za-z0-9_-`.
 */
export interface LinkCode {
  readonly value: string;
  readonly hash: string;
}

export interface LinkCodeFactory {
  create(): LinkCode;
  hash(value: string): string;
}

/** Lo que la bitácora necesita saber de la cuenta, y nada más. */
export interface AccountStatus {
  hasVerifiedEmail(userId: UserId): Promise<boolean>;
}

/**
 * Dónde viven las fotos de la bitácora.
 *
 * Es el primer sitio del API que **escribe bytes** en el almacenamiento: todo
 * lo demás firma una política para que el navegador suba directo. Acá no hay
 * navegador, el archivo llega de Telegram.
 */
export interface JournalPhotos {
  put(key: string, bytes: Uint8Array, mimeType: string): Promise<void>;
  /** Una URL de lectura firmada y de vida corta. El bucket es privado. */
  linkTo(key: string): Promise<string>;
  /** "Lo mejor que se pueda": un objeto huérfano es basura, no un callejón. */
  remove(key: string): Promise<void>;
}

/** Lo que la bitácora le dice al chat. */
export interface ChatVoice {
  say(
    chatId: string,
    text: string,
    buttons?: readonly { label: string; data: string }[],
  ): Promise<void>;
  /**
   * Acusa el toque de un botón. Sin esto se queda girando en el teléfono.
   *
   * Sin texto: lo que hay que decir ya va en el mensaje que se manda después, y
   * el aviso flotante de Telegram tapa el chat sin aportar nada.
   */
  acknowledge(callbackId: string): Promise<void>;
  /** Le quita el teclado a un mensaje ya mandado. */
  clearKeyboard(chatId: string, messageId: number): Promise<void>;
  /** Baja un archivo de Telegram. `null` si no se pudo. */
  download(fileId: string): Promise<Uint8Array | null>;
}

export const HABIT_REPOSITORY = Symbol('HabitRepository');
export const ENTRY_REPOSITORY = Symbol('EntryRepository');
export const ACCOUNT_CHAT_REPOSITORY = Symbol('AccountChatRepository');
export const JOURNAL_LINK_CODES = Symbol('JournalLinkCodeFactory');
export const JOURNAL_ACCOUNT_STATUS = Symbol('JournalAccountStatus');
export const JOURNAL_PHOTOS = Symbol('JournalPhotos');
export const CHAT_VOICE = Symbol('ChatVoice');
