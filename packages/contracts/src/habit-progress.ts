/**
 * Cómo se mide un hábito de la bitácora.
 *
 * La unidad es **la anotación**, no el mensaje: una sesión de gimnasio contada
 * con tres fotos es una vez, no tres. La meta dice cuántas veces al día y en
 * qué días de la semana aplica; un día aplicable vale `min(veces / meta, 1)`.
 *
 * Todo trabaja con claves de día `AAAA-MM-DD` ya cortadas en la zona que toque,
 * así que acá no hay husos horarios: la aritmética se hace en UTC a propósito.
 */

/** Los siete días, con el lunes en el bit 0. */
export const ALL_DAYS = 0b111_1111;

/** Lunes a viernes. */
export const WEEKDAYS_ONLY = 0b001_1111;

export const HABIT_DAILY_TARGET_MAX = 10;

/** Cuántos días mira el porcentaje de cumplimiento. */
export const RATE_WINDOW_DAYS = 30;

export interface HabitGoal {
  readonly dailyTarget: number;
  /** Máscara de bits: lunes = 1, martes = 2 … domingo = 64. */
  readonly activeDays: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toTime(key: string): number {
  return Date.parse(`${key}T00:00:00Z`);
}

function toKey(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

/** La clave de `n` días después (o antes, con `n` negativo). */
export function addDays(key: string, n: number): string {
  return toKey(toTime(key) + n * DAY_MS);
}

/** 0 = lunes … 6 = domingo. */
export function weekdayOf(key: string): number {
  return (new Date(toTime(key)).getUTCDay() + 6) % 7;
}

export function appliesOn(activeDays: number, key: string): boolean {
  return (activeDays & (1 << weekdayOf(key))) !== 0;
}

/** De 0 a 1. Pasarse de la meta no suma más. */
export function dayScore(count: number, dailyTarget: number): number {
  return Math.min(count / dailyTarget, 1);
}

export interface HabitProgress {
  readonly todayCount: number;
  readonly todayApplies: boolean;
  /** Solo en un día que aplica: anotar en un día libre no cumple nada. */
  readonly todayDone: boolean;
  /** Días aplicables seguidos con la meta cumplida. Hoy a medias no la corta. */
  readonly streak: number;
  readonly bestStreak: number;
  /** Promedio de los días aplicables de la ventana, o `null` si no hubo ninguno. */
  readonly rate: number | null;
}

/**
 * El avance de un hábito hasta `today`, contando desde `since` (el día en que
 * se creó: lo anterior no puede contar como fallo).
 */
export function progressOf(input: {
  perDay: ReadonlyMap<string, number>;
  goal: HabitGoal;
  since: string;
  today: string;
}): HabitProgress {
  const { perDay, goal, today } = input;
  const since = input.since > today ? today : input.since;
  const windowStart = addDays(today, -(RATE_WINDOW_DAYS - 1));

  let streak = 0;
  let bestStreak = 0;
  let scored = 0;
  let total = 0;

  for (let key = since; key <= today; key = addDays(key, 1)) {
    if (!appliesOn(goal.activeDays, key)) continue;

    const score = dayScore(perDay.get(key) ?? 0, goal.dailyTarget);
    const done = score === 1;
    const isToday = key === today;

    // Hoy todavía se puede cumplir: solo cuenta si ya se cumplió.
    if (isToday && !done) continue;

    streak = done ? streak + 1 : 0;
    bestStreak = Math.max(bestStreak, streak);

    if (key >= windowStart) {
      total += score;
      scored += 1;
    }
  }

  const todayCount = perDay.get(today) ?? 0;
  const todayApplies = appliesOn(goal.activeDays, today);

  return {
    todayCount,
    todayApplies,
    todayDone: todayApplies && dayScore(todayCount, goal.dailyTarget) === 1,
    streak,
    bestStreak,
    rate: scored === 0 ? null : total / scored,
  };
}
