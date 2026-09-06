import type { HabitPlanId, LibraryId, RecipientId, UserId } from '../../shared/identifiers';
import type { CivilDay } from './civil-day';
import type { HabitPlan } from './habit-plan';
import type { DayScore } from './scoring';
import type { HabitAnswer } from './vocabulary';

export interface HabitPlanRepository {
  add(plan: HabitPlan): Promise<void>;
  save(plan: HabitPlan): Promise<void>;
  listOwnedBy(ownerId: UserId): Promise<HabitPlan[]>;
  findOwned(id: HabitPlanId, ownerId: UserId): Promise<HabitPlan | null>;
  /**
   * Cuáles de esas bibliotecas ya están en un plan vivo **hacia esa persona**.
   *
   * La pareja y no la biblioteca sola: la misma biblioteca puede ser un hábito
   * de dos planes mientras vayan a gente distinta, porque son horarios y envíos
   * distintos. Lo que no puede es ir dos veces a la misma persona.
   *
   * Es una comprobación amable para poder decir *cuál* choca; la que de verdad
   * lo impide es el índice único parcial de la tabla, que dos peticiones a la
   * vez no pueden saltarse.
   */
  librariesInUse(
    libraryIds: readonly LibraryId[],
    recipientId: RecipientId,
  ): Promise<{ libraryId: string; label: string }[]>;
  /**
   * Los planes vivos a los que les falta cerrar algún día.
   *
   * El corte lo hace la base con la zona de cada plan —cada uno corta el día
   * donde le toca—, y no se toma nada: quien decide quién cierra el día es
   * `commitDay`, que es la única escritura.
   */
  listDueForScoring(now: Date, limit: number): Promise<HabitPlan[]>;
  /**
   * Cierra un día: escribe sus filas y avanza el plan, todo o nada.
   *
   * Devuelve `false` si otra réplica se adelantó. La condición es que
   * `scored_through` siga donde estaba cuando se leyó el plan, así que dos
   * procesos cerrando el mismo día no pueden mandar dos resúmenes: solo uno
   * llega a escribir. Se prefiere esto a bloquear la fila porque entre leer y
   * escribir hay que consultar los envíos, y tener abierta una transacción
   * mientras tanto es peor que reintentar el día siguiente.
   */
  commitDay(input: {
    planId: HabitPlanId;
    previous: CivilDay | null;
    day: CivilDay;
    rows: readonly ScoredDay[];
  }): Promise<boolean>;
  /** El plan vivo al que pertenece un envío, si es que pertenece a alguno. */
  findActiveForDelivery(deliveryId: string): Promise<{
    plan: HabitPlan;
    libraryId: string;
    chatId: string | null;
    /**
     * Cuándo salió el envío.
     *
     * Hace falta para saber a qué día pertenece la respuesta, que no tiene por
     * qué ser el día en que alguien aprieta el botón: un envío de las once de
     * la noche se contesta a menudo a la mañana siguiente.
     */
    occurredAt: Date;
  } | null>;
}

/** Un envío que salió de verdad, tal como lo cuenta un plan. */
export interface SentDelivery {
  readonly deliveryId: string;
  readonly libraryId: string;
}

/**
 * Lo que `habits` necesita saber de los envíos, y nada más.
 *
 * Un contexto no importa el dominio de otro: esto se implementa leyendo las
 * tablas directamente, igual que hace `scheduling` con las bibliotecas.
 */
export interface DeliveryDirectory {
  /**
   * Los envíos que salieron hacia ese destinatario desde esas bibliotecas,
   * entre esos dos instantes.
   *
   * Solo los que llegaron de verdad: lo que se saltó o falló no puede contar en
   * el denominador, o el usuario cargaría con un fallo del servidor.
   */
  sentBetween(
    recipientId: RecipientId,
    libraryIds: readonly LibraryId[],
    from: Date,
    to: Date,
  ): Promise<SentDelivery[]>;
}

/** Lo que `habits` necesita saber de las bibliotecas. */
export interface LibraryDirectory {
  /**
   * Las bibliotecas de esa cuenta que estén entre las pedidas, con su nombre.
   *
   * Se pregunta por la cuenta y no por la biblioteca suelta a propósito: lo que
   * no salga en la respuesta no es de quien pregunta. El baúl viene marcado
   * porque no puede ser un hábito.
   */
  ownedAmong(
    ownerId: UserId,
    libraryIds: readonly LibraryId[],
  ): Promise<{ id: string; name: string; isVault: boolean }[]>;
}

export interface RecipientDirectory {
  /** La etiqueta, el chat y si ya está vinculado. `null` si no es de esa cuenta. */
  find(
    recipientId: RecipientId,
    ownerId: UserId,
  ): Promise<{ label: string; chatId: string | null } | null>;
  /**
   * La etiqueta de cada uno, para el listado.
   *
   * El dueño va en la firma y llega hasta el `where`, igual que en el resto del
   * repositorio: no existe una lectura suelta que después compruebe de quién
   * era la fila.
   */
  labelsOf(ownerId: UserId, recipientIds: readonly string[]): Promise<Map<string, string>>;
  /**
   * El chat al que escribirle, o `null` si se desvinculó.
   *
   * Se pregunta cada vez y no se guarda con el plan: alguien puede bloquear al
   * bot a mitad de los treinta días, y un chat copiado al crear el plan
   * seguiría pareciendo válido hasta que el envío fallara.
   */
  chatOf(ownerId: UserId, recipientId: RecipientId): Promise<string | null>;
}

/** La respuesta de alguien a un envío. */
export interface StoredResponse {
  readonly deliveryId: string;
  readonly libraryId: string;
  readonly answer: HabitAnswer;
}

export interface ResponseStore {
  /**
   * Anota la respuesta. Devuelve `false` si ese envío ya tenía una.
   *
   * **Solo inserta.** Que una votación no se pueda cambiar lo decide la clave
   * primaria de la tabla y no una consulta previa, que dos toques a la vez
   * podrían pasar los dos.
   */
  record(response: {
    deliveryId: string;
    planId: string;
    libraryId: string;
    answer: HabitAnswer;
    answeredAt: Date;
  }): Promise<boolean>;
  /** Las respuestas que llegaron para esos envíos. */
  of(deliveryIds: readonly string[]): Promise<StoredResponse[]>;
}

/** Una fila de la rejilla: un hábito en un día, ya cerrado. */
export interface ScoredDay extends DayScore {
  readonly libraryId: string;
  readonly day: CivilDay;
  /** Cuántos de los envíos de ese día tuvieron respuesta. */
  readonly answered: number;
}

export interface ScoreStore {
  listOf(planId: string): Promise<ScoredDay[]>;
  /** Los días cerrados de varios planes de una vez, para el listado. */
  ofPlans(planIds: readonly string[]): Promise<Map<string, ScoredDay[]>>;
}

/**
 * El calendario del sistema: traduce entre instantes y días civiles.
 *
 * Está detrás de un puerto porque necesita la base de zonas horarias y el
 * núcleo es TypeScript pelado — el mismo motivo por el que `scheduling` tiene
 * su `OccurrencePlanner`.
 */
export interface DayCalendar {
  /** En qué día civil cae ese instante, visto desde esa zona. */
  dayAt(moment: Date, timezone: string): CivilDay;
  /** Los dos extremos de ese día civil en esa zona, en UTC. */
  boundsOf(day: CivilDay, timezone: string): { from: Date; to: Date };
}

/**
 * Le habla al destinatario del plan por su chat.
 *
 * Manda el resumen de cada día y el informe del final. Es otro puerto que el de
 * `delivery` a propósito: aquello envía archivos de una biblioteca, esto manda
 * un texto que escribe la aplicación.
 */
export interface PlanNotifier {
  /**
   * Devuelve si el mensaje salió de verdad.
   *
   * No es un `void` por comodidad: el informe de cierre se sella como enviado
   * en el plan, y sellarlo cuando Telegram lo rechazó dejaría al dueño mirando
   * una fecha de envío que no ocurrió.
   */
  send(chatId: string, text: string): Promise<boolean>;
}

export const HABIT_PLAN_REPOSITORY = Symbol('HabitPlanRepository');
export const DELIVERY_DIRECTORY = Symbol('DeliveryDirectory');
export const HABIT_LIBRARY_DIRECTORY = Symbol('HabitLibraryDirectory');
export const HABIT_RECIPIENT_DIRECTORY = Symbol('HabitRecipientDirectory');
export const RESPONSE_STORE = Symbol('ResponseStore');
export const SCORE_STORE = Symbol('ScoreStore');
export const DAY_CALENDAR = Symbol('DayCalendar');
export const PLAN_NOTIFIER = Symbol('PlanNotifier');
