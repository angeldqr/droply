import { z } from 'zod';
import { timezoneSchema } from './identity.js';
import {
  itemKind,
  selectionStrategy,
  type DeliveryStatus,
  type ItemKind,
  type SelectionStrategy,
} from './primitives.js';

/** Con qué nombre llega el envío. Vacío significa el nombre de la cuenta. */
export const SENDER_NAME_MAX_LENGTH = 40;

/** Lunes es 1 y domingo es 7, la misma numeración que usa Luxon. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Readonly<Record<Weekday, string>> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

/** La inicial, para las siete casillas de la pantalla. */
export const WEEKDAY_INITIALS: Readonly<Record<Weekday, string>> = {
  1: 'L',
  2: 'M',
  3: 'X',
  4: 'J',
  5: 'V',
  6: 'S',
  7: 'D',
};

/** Al menos un día: sin ninguno, el horario no se dispararía jamás. */
export const weekdaysSchema = z
  .array(
    z.union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
      z.literal(6),
      z.literal(7),
    ]),
  )
  .min(1, 'Elige al menos un día.')
  .max(7);

const MINUTES_IN_A_DAY = 24 * 60;

/** Un momento del día, en minutos desde medianoche. */
export const dayMinuteSchema = z
  .number()
  .int()
  .min(0)
  .max(MINUTES_IN_A_DAY - 1);

/** "8:00", a partir de los minutos que guarda la base. */
export function formatDayMinute(minute: number): string {
  const hour = Math.floor(minute / 60);

  return `${hour}:${String(minute % 60).padStart(2, '0')}`;
}

/**
 * Cuándo sale un envío: qué días de la semana, y entre qué hora y qué hora.
 *
 * No hay fecha de fin a propósito: un horario corre hasta que se pausa. Y la
 * franja no es decoración — dentro de ella se reparten los envíos de cada
 * archivo según cuántas veces al día pida.
 */
export const createScheduleSchema = z
  .object({
    libraryId: z.uuid(),
    recipientId: z.uuid(),
    weekdays: weekdaysSchema,
    startMinute: dayMinuteSchema,
    endMinute: dayMinuteSchema,
    timezone: timezoneSchema,
    senderName: z.string().trim().max(SENDER_NAME_MAX_LENGTH).nullish(),
    strategy: selectionStrategy.schema.default('RANDOM'),
    /** Sin filtro se envía de las cuatro columnas. */
    kindFilter: itemKind.schema.nullish(),
  })
  .refine((value) => value.endMinute > value.startMinute, {
    path: ['endMinute'],
    message: 'La hora de fin tiene que ser posterior a la de inicio.',
  });

export const updateScheduleSchema = z
  .object({
    weekdays: weekdaysSchema.optional(),
    startMinute: dayMinuteSchema.optional(),
    endMinute: dayMinuteSchema.optional(),
    timezone: timezoneSchema.optional(),
    senderName: z.string().trim().max(SENDER_NAME_MAX_LENGTH).nullish(),
    strategy: selectionStrategy.schema.optional(),
    kindFilter: itemKind.schema.nullish(),
    active: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.startMinute === undefined ||
      value.endMinute === undefined ||
      value.endMinute > value.startMinute,
    { path: ['endMinute'], message: 'La hora de fin tiene que ser posterior a la de inicio.' },
  );

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;

export interface ScheduleView {
  readonly id: string;
  readonly libraryId: string;
  readonly libraryName: string;
  readonly recipientId: string;
  readonly recipientLabel: string;
  readonly weekdays: readonly number[];
  readonly startMinute: number;
  readonly endMinute: number;
  readonly timezone: string;
  /** Nulo cuando el horario firma con el nombre de la cuenta. */
  readonly senderName: string | null;
  readonly strategy: SelectionStrategy;
  readonly kindFilter: ItemKind | null;
  readonly active: boolean;
  /** El próximo envío en UTC, o `null` si ya no vuelve a repetirse. */
  readonly nextRunAt: string | null;
  readonly lastRunAt: string | null;
}

export const STRATEGY_LABELS: Readonly<Record<SelectionStrategy, string>> = {
  RANDOM: 'Al azar',
  RANDOM_NO_REPEAT: 'Al azar sin repetir',
  SEQUENTIAL: 'En orden',
};

export const STRATEGY_HINTS: Readonly<Record<SelectionStrategy, string>> = {
  RANDOM: 'Puede repetir antes de recorrerla entera.',
  RANDOM_NO_REPEAT: 'Recorre toda la biblioteca antes de repetir nada.',
  SEQUENTIAL: 'Sigue el orden de las columnas, de arriba abajo.',
};

/** "Lunes a viernes" en vez de listar cinco días uno por uno. */
export function describeWeekdays(weekdays: readonly number[]): string {
  const days = [...new Set(weekdays)].sort((left, right) => left - right);

  if (days.length === 7) return 'Todos los días';
  if (days.length === 5 && days.every((day) => day <= 5)) return 'De lunes a viernes';
  if (days.length === 2 && days[0] === 6 && days[1] === 7) return 'Fines de semana';

  return days.map((day) => WEEKDAY_LABELS[day as Weekday]).join(', ');
}

/** Un envío que ya ocurrió, tal como lo muestra el historial. */
export interface DeliveryRecordView {
  readonly id: string;
  readonly scheduleId: string;
  readonly libraryName: string;
  readonly recipientLabel: string;
  readonly status: DeliveryStatus;
  /** Por qué no salió. Nulo cuando salió bien. */
  readonly error: string | null;
  readonly occurredAt: string;
}

export const DELIVERY_STATUS_LABELS: Readonly<Record<DeliveryStatus, string>> = {
  SENT: 'Enviado',
  FAILED: 'Falló',
  SKIPPED: 'Sin enviar',
};
