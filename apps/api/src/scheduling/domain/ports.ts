import type { PlannedItem } from '../../shared/day-plan';
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
   * Los elementos que entran en el plan del día, con lo que hace falta para
   * repartirlos: cuántas veces al día pide cada uno y en qué orden está.
   *
   * Solo los que se pueden enviar —un archivo a medio subir no abre hueco en la
   * rejilla— y solo los de la columna filtrada si la hay.
   */
  planItemsOf(libraryId: LibraryId, kindFilter: ItemKind | null): Promise<PlannedItem[]>;
  /**
   * Los elementos de esa biblioteca que estén entre los pedidos.
   *
   * Se pregunta por la biblioteca y no por el elemento suelto a propósito: es
   * la única forma de que clavar un archivo ajeno en un horario no cuele. Lo
   * que no salga en la respuesta, no es de ahí.
   */
  itemsOf(
    libraryId: LibraryId,
    itemIds: readonly string[],
  ): Promise<{ id: string; kind: ItemKind; label: string }[]>;
}

/** Un envío clavado: a este minuto del día sale este elemento y no otro. */
export interface FixedItem {
  readonly minute: number;
  readonly itemId: string;
}

/**
 * Los envíos fijos de un horario.
 *
 * Se reemplazan en bloque y no de uno en uno: la pantalla manda la lista
 * entera, así que guardar la diferencia sería inventar un protocolo que nadie
 * pidió. La unicidad por hora la impone la clave primaria de la tabla.
 */
export interface FixedItemRepository {
  listOf(scheduleId: ScheduleId): Promise<FixedItem[]>;
  replace(scheduleId: ScheduleId, items: readonly FixedItem[]): Promise<void>;
  /** Las horas clavadas, que son las que la rejilla tiene que incluir. */
  minutesOf(scheduleId: ScheduleId): Promise<number[]>;
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
export const FIXED_ITEM_REPOSITORY = Symbol('FixedItemRepository');
