import type { PlanHabit } from './habit-plan';
import { averagePercent, percentOf } from './scoring';
import type { ScoredDay } from './ports';

/** Lo que se le dice al destinatario de un hábito, en una línea. */
interface HabitLine {
  readonly label: string;
  readonly percent: number | null;
}

/**
 * El resumen del día que se acaba de cerrar.
 *
 * Corto a propósito: llega a medianoche y a un chat, no a un tablero. Los
 * hábitos que ese día no tenían nada que hacer no se nombran —decir «Leer: sin
 * envíos» tres veces por semana entrena a la gente a no leer el mensaje—.
 */
export function dailySummary(input: {
  planName: string;
  dayNumber: number;
  durationDays: number;
  lines: readonly HabitLine[];
}): string {
  const counted = input.lines.filter((line) => line.percent !== null);
  const total = averagePercent(counted.map((line) => line.percent));

  const body =
    counted.length === 0
      ? ['Hoy no salió nada de este plan.']
      : counted.map((line) => `${line.label}: ${format(line.percent)}`);

  return [
    `${input.planName} · día ${input.dayNumber} de ${input.durationDays}`,
    '',
    ...body,
    ...(total === null ? [] : ['', `Total del día: ${format(total)}`]),
  ].join('\n');
}

/**
 * El informe del final.
 *
 * Lleva el promedio de cada hábito sobre todo el plazo y el del plan entero.
 * Es el mismo texto que se vuelve a mandar si el dueño pide reenviarlo: un
 * informe que cambiara entre un envío y el siguiente no sería un informe.
 */
export function closingReport(input: {
  planName: string;
  durationDays: number;
  habits: readonly PlanHabit[];
  days: readonly ScoredDay[];
}): string {
  const lines = input.habits.map((habit) => ({
    label: habit.label,
    percent: averageOf(input.days, habit.libraryId),
  }));

  const total = averagePercent(lines.map((line) => line.percent));

  return [
    `Terminó «${input.planName}»`,
    `${input.durationDays} días.`,
    '',
    ...lines.map((line) => `${line.label}: ${format(line.percent)}`),
    '',
    `Total del plan: ${format(total)}`,
  ].join('\n');
}

/** El promedio de un hábito sobre los días que contaron. */
export function averageOf(days: readonly ScoredDay[], libraryId: string): number | null {
  return averagePercent(
    days.filter((day) => day.libraryId === libraryId).map((day) => percentOf(day)),
  );
}

/** «Sin datos» y no «0%»: no es lo mismo fallar que no haber tenido ocasión. */
function format(percent: number | null): string {
  return percent === null ? 'sin datos' : `${percent}%`;
}
