import { z } from 'zod';
import { ALL_DAYS, HABIT_DAILY_TARGET_MAX, type HabitPauseRange } from './habit-progress.js';

/**
 * La bitácora de hábitos.
 *
 * Es la otra mitad del bot, y va al revés que todo lo demás: en vez de que la
 * aplicación mande algo y espere respuesta, es el usuario quien escribe desde
 * Telegram y la aplicación archiva. **No recuerda nada ni empuja nada.**
 */

export const HABIT_NAME_MAX_LENGTH = 40;

/**
 * Cuántos hábitos puede llevar una cuenta.
 *
 * El techo lo pone el chat, no la base: el bot manda la lista como un teclado
 * de botones, y más de veinte obliga a bajar por una pantalla de teléfono para
 * elegir. Quien necesite más está llevando otra cosa, no hábitos.
 */
export const HABITS_MAX = 20;

/** Lo que cabe en una anotación. Es un mensaje de chat, no un diario. */
export const ENTRY_NOTE_MAX_LENGTH = 2000;

/** Cuántas fotos admite una anotación antes de que el bot diga que basta. */
export const ENTRY_PHOTOS_MAX = 10;

/**
 * Cuánto aguanta abierta una anotación sin que llegue nada.
 *
 * Media hora es lo que separa «sigo contando lo del gimnasio» de «vuelvo por la
 * tarde a contar otra cosa». Pasado eso, el bot pide elegir hábito otra vez en
 * vez de pegar lo nuevo a lo de la mañana.
 */
export const ENTRY_IDLE_MINUTES = 30;

const habitName = z.string().trim().min(1, 'Ponle un nombre.').max(HABIT_NAME_MAX_LENGTH);

/** Cuántas anotaciones en el día lo dan por cumplido. */
const dailyTarget = z
  .number()
  .int()
  .min(1, 'Al menos una vez al día.')
  .max(HABIT_DAILY_TARGET_MAX, `Como mucho ${HABIT_DAILY_TARGET_MAX} veces al día.`);

/** Máscara con el lunes en el bit 0. Ver `habit-progress`. */
const activeDays = z.number().int().min(1, 'Elige al menos un día.').max(ALL_DAYS);

export const createHabitSchema = z.object({
  name: habitName,
  dailyTarget: dailyTarget.default(1),
  activeDays: activeDays.default(ALL_DAYS),
});

export const updateHabitSchema = z
  .object({
    name: habitName.optional(),
    dailyTarget: dailyTarget.optional(),
    activeDays: activeDays.optional(),
  })
  .refine(
    (body) =>
      body.name !== undefined || body.dailyTarget !== undefined || body.activeDays !== undefined,
    'No hay nada que cambiar.',
  );

/** Lo que manda la pantalla: la meta puede faltar. */
export type CreateHabitInput = z.input<typeof createHabitSchema>;
/** Lo que recibe la API ya validado, con los valores por defecto puestos. */
export type CreateHabitBody = z.output<typeof createHabitSchema>;
export type UpdateHabitInput = z.infer<typeof updateHabitSchema>;

/** Una foto de una anotación, con su enlace firmado y de vida corta. */
export interface EntryPhotoView {
  readonly id: string;
  /** Firmada, como las de las bibliotecas. `null` si el enlace no se pudo firmar. */
  readonly url: string | null;
  /** La versión mediana para las rejillas. `null` si no hay: se usa `url`. */
  readonly thumbUrl: string | null;
}

export interface HabitEntryView {
  readonly id: string;
  readonly note: string | null;
  readonly photos: readonly EntryPhotoView[];
  readonly openedAt: string;
  /** Nulo mientras el usuario puede seguir agregándole cosas desde el chat. */
  readonly closedAt: string | null;
}

/** Un día de la semana de la tarjeta. */
export interface WeekDayView {
  /** `AAAA-MM-DD` en la zona de la cuenta. */
  readonly day: string;
  readonly count: number;
}

export interface HabitView {
  readonly id: string;
  readonly name: string;
  readonly position: number;
  /** Veces al día que lo dan por cumplido. */
  readonly dailyTarget: number;
  /** En qué días de la semana aplica. Ver `habit-progress`. */
  readonly activeDays: number;
  readonly createdAt: string;
  readonly entryCount: number;
  /** Hoy en la zona de la cuenta, `AAAA-MM-DD`: el día que la tarjeta resalta. */
  readonly today: string;
  /**
   * La semana en curso, de lunes a domingo, con las anotaciones de cada día.
   * Los días que todavía no llegan vienen en cero.
   */
  readonly week: readonly WeekDayView[];
  /** Días aplicables seguidos con la meta cumplida, hasta hoy. */
  readonly streak: number;
  /** Si hoy está en pausa: no cuenta, no sale en el bot. */
  readonly paused: boolean;
  /** Los tramos en pausa, del más viejo al más nuevo. */
  readonly pauses: readonly HabitPauseRange[];
  /** Cuándo fue la última vez que se anotó algo. Nulo si nunca. */
  readonly lastEntryAt: string | null;
}

/**
 * El estado del chat de la cuenta.
 *
 * `linkUrl` solo trae valor en la respuesta que emite el enlace: el código se
 * guarda hasheado y no se puede volver a mostrar, igual que el de los
 * destinatarios. Para verlo otra vez hay que pedir uno nuevo.
 */
export interface AccountChatView {
  readonly linked: boolean;
  readonly linkUrl: string | null;
  readonly linkExpiresAt: string | null;
}

/**
 * El comando que abre la bitácora desde el chat.
 *
 * Vive en el contrato porque lo nombran los dos lados: el bot lo atiende y la
 * pantalla se lo explica al usuario. Escrito dos veces, se separan el día que
 * alguien lo cambie.
 */
export const JOURNAL_COMMAND = '/habits';

/** El comando que dice cómo va el día. Mismo motivo para vivir acá. */
export const JOURNAL_TODAY_COMMAND = '/hoy';
