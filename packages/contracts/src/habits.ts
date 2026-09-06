import { z } from 'zod';
import { timezoneSchema } from './identity.js';
import type { HabitAnswer, HabitPlanStatus } from './primitives.js';

export const HABIT_PLAN_NAME_MAX_LENGTH = 60;

/**
 * Cuántas bibliotecas caben en un plan.
 *
 * Es el mismo tope que el de bibliotecas por cuenta, así que en la práctica no
 * puede morder: existe solo para que el borde HTTP no acepte un arreglo sin
 * fondo. El cliente pidió «una o varias» y esto no lo contradice.
 */
export const HABIT_PLAN_LIBRARIES_MAX = 20;

/**
 * Los plazos, cerrados a cuatro.
 *
 * No es un número libre a propósito: un plan de hábitos vive de que el plazo se
 * sienta alcanzable, y estos cuatro son los que la gente ya reconoce.
 */
export const HABIT_PLAN_DURATIONS = [7, 14, 21, 30] as const;

export type HabitPlanDuration = (typeof HABIT_PLAN_DURATIONS)[number];

export const habitDurationSchema = z.union([
  z.literal(7),
  z.literal(14),
  z.literal(21),
  z.literal(30),
]);

/**
 * Un plan nuevo.
 *
 * `recipientId` es uno solo: el plan le manda a esa persona el resumen de cada
 * día y el informe del final, así que dos destinatarios serían dos planes.
 * `libraryIds` son los hábitos, y no se pueden cambiar después — para eso está
 * anular.
 */
export const createHabitPlanSchema = z.object({
  name: z.string().trim().min(1, 'Ponle un nombre.').max(HABIT_PLAN_NAME_MAX_LENGTH),
  recipientId: z.uuid(),
  durationDays: habitDurationSchema,
  /**
   * La zona en la que se corta el día de este plan.
   *
   * La manda el navegador, igual que al crear un horario: es la que el usuario
   * tiene en la cabeza cuando dice «el resumen de hoy». Se copia al plan y no
   * se vuelve a leer, así que mudarse de país a mitad de los treinta días no le
   * mueve los días ya contados.
   */
  timezone: timezoneSchema,
  libraryIds: z
    .array(z.uuid())
    .min(1, 'Elige al menos una biblioteca.')
    .max(HABIT_PLAN_LIBRARIES_MAX)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'Hay una biblioteca repetida.',
    }),
});

export type CreateHabitPlanInput = z.infer<typeof createHabitPlanSchema>;

/**
 * Lo que rindió un hábito en un día ya cerrado.
 *
 * `percent` en `null` es un día que no cuenta: o todavía no llegó, o ese día no
 * salió nada de esa biblioteca. Contarlo como cero castigaría al usuario por
 * los días en que su horario simplemente no dispara.
 */
export interface HabitDayView {
  /** La fecha civil del plan, `AAAA-MM-DD`. */
  readonly day: string;
  readonly sent: number;
  readonly answered: number;
  readonly percent: number | null;
}

/** Un hábito del plan: una biblioteca, con su fila de días y su promedio. */
export interface HabitProgressView {
  readonly libraryId: string;
  /** El nombre con el que entró al plan. Sobrevive a que la biblioteca se borre. */
  readonly label: string;
  /** Promedio de los días que contaron, o `null` si ninguno contó todavía. */
  readonly percent: number | null;
  readonly days: readonly HabitDayView[];
}

export interface HabitPlanSummary {
  readonly id: string;
  readonly name: string;
  readonly recipientId: string;
  readonly recipientLabel: string;
  readonly durationDays: number;
  readonly timezone: string;
  readonly startOn: string;
  readonly endOn: string;
  readonly status: HabitPlanStatus;
  /** Qué día del plan va, de 1 a `durationDays`. */
  readonly dayNumber: number;
  /**
   * Las bibliotecas que son hábitos de este plan.
   *
   * Van en el resumen y no solo en el detalle porque la pantalla de crear un
   * plan las necesita todas a la vez: una biblioteca que ya está en un plan
   * vivo no puede entrar en otro, y sin esto habría que pedir el detalle de
   * cada plan solo para poder deshabilitar tres casillas.
   */
  readonly libraryIds: readonly string[];
  /** El promedio de sus hábitos, o `null` si aún no hay ningún día cerrado. */
  readonly percent: number | null;
  readonly reportSentAt: string | null;
}

export interface HabitPlanDetail extends HabitPlanSummary {
  readonly habits: readonly HabitProgressView[];
}

export const HABIT_PLAN_STATUS_LABELS: Readonly<Record<HabitPlanStatus, string>> = {
  ACTIVE: 'En marcha',
  CANCELLED: 'Anulado',
  CLOSED: 'Terminado',
};

export const HABIT_ANSWER_LABELS: Readonly<Record<HabitAnswer, string>> = {
  DONE: 'Realizado',
  HALF: '50%',
  MISSED: 'No cumplido',
};
