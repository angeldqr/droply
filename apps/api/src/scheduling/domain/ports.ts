import type { LibraryId, RecipientId, ScheduleId, UserId } from '../../shared/identifiers';
import type { ItemKind } from './item-kind';
import type { Schedule } from './schedule';

export interface ScheduleRepository {
  listOwnedBy(ownerId: UserId): Promise<Schedule[]>;
  findOwned(id: ScheduleId, ownerId: UserId): Promise<Schedule | null>;
  add(schedule: Schedule): Promise<void>;
  save(schedule: Schedule): Promise<void>;
  remove(id: ScheduleId, ownerId: UserId): Promise<void>;
  /**
   * Toma los horarios vencidos y los deja tomados para quien llamó.
   *
   * Es lo que permite que corran varias réplicas sin enviar dos veces: la
   * consulta bloquea las filas y se salta las que otro ya tenga (`FOR UPDATE
   * SKIP LOCKED`). Sin eso, dos procesos leerían el mismo horario vencido y el
   * destinatario recibiría el mismo envío por duplicado.
   */
  claimDue(now: Date, limit: number): Promise<Schedule[]>;
}

/** Cuándo tiene algo que enviar un horario: qué días, y a qué minutos del día. */
export interface DailyWindow {
  /** 1 = lunes … 7 = domingo. */
  readonly weekdays: readonly number[];
  /** Minutos desde medianoche, la rejilla que arma `gridOf`. */
  readonly minutes: readonly number[];
}

/**
 * Traduce la ventana de un horario a la próxima fecha real.
 *
 * Está detrás de un puerto porque el cálculo necesita la base de zonas horarias
 * del sistema, y el núcleo es TypeScript pelado. Además deja probar el resto
 * con ocurrencias fijas, sin depender del calendario.
 */
export interface OccurrencePlanner {
  /**
   * La primera ocurrencia **estrictamente después** de `after`, o `null` si no
   * hay ninguna. `after` y el resultado van en UTC; la zona solo dice a qué
   * hora local corresponden.
   */
  nextAfter(window: DailyWindow, timezone: string, after: Date): Date | null;
}

/** Lo que scheduling necesita saber de los otros contextos, y nada más. */
export interface LibraryDirectory {
  /** El nombre, o `null` si la biblioteca no es de esa cuenta. */
  nameOf(libraryId: LibraryId, ownerId: UserId): Promise<string | null>;
  /**
   * Si esa biblioteca admite mandarle cosas a ese destinatario.
   *
   * La lista la elige el dueño en la propia biblioteca: tener tres bibliotecas
   * no significa que las tres vayan a las mismas personas.
   */
  allows(libraryId: LibraryId, recipientId: RecipientId): Promise<boolean>;
  /**
   * Cuántas veces al día pide enviarse cada elemento de la biblioteca.
   *
   * Es lo que densifica la rejilla del horario: un archivo que pide cinco
   * envíos obliga a mirar cinco momentos del día, aunque los demás pidan uno.
   * Solo los elementos listos, y solo los de la columna filtrada si la hay.
   */
  sendTimesOf(libraryId: LibraryId, kindFilter: ItemKind | null): Promise<number[]>;
}

export interface RecipientDirectory {
  /** La etiqueta y si ya está vinculado. `null` si no es de esa cuenta. */
  find(
    recipientId: RecipientId,
    ownerId: UserId,
  ): Promise<{ label: string; isLinked: boolean } | null>;
}

export const SCHEDULE_REPOSITORY = Symbol('ScheduleRepository');
export const OCCURRENCE_PLANNER = Symbol('OccurrencePlanner');
export const LIBRARY_DIRECTORY = Symbol('LibraryDirectory');
export const RECIPIENT_DIRECTORY = Symbol('RecipientDirectory');
