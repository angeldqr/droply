import type { HabitAnswer } from './vocabulary';

/**
 * Cuánto vale cada respuesta.
 *
 * Es la regla que pidió el cliente, literal: si en un día salen cien archivos,
 * cada uno vale un uno por ciento cuando se marca como realizado. El botón del
 * medio vale la mitad; no responder es lo mismo que no cumplir.
 */
export const VALUE_OF: Readonly<Record<HabitAnswer, number>> = {
  DONE: 1,
  HALF: 0.5,
  MISSED: 0,
};

/** El resultado de un hábito en un día, ya cerrado. */
export interface DayScore {
  /** Cuántos archivos salieron ese día por ese hábito. */
  readonly sent: number;
  /** La suma de los valores de las respuestas que llegaron. */
  readonly earned: number;
}

/**
 * Suma un día a partir de lo que salió y lo que se contestó.
 *
 * Lo que salió y no tiene respuesta cuenta cero sin aparecer acá: por eso el
 * denominador es `sent` y no la cantidad de respuestas. Es justo la regla de
 * «si el usuario no responde será catalogada como actividad no cumplida».
 */
export function scoreDay(sent: number, answers: readonly HabitAnswer[]): DayScore {
  return {
    sent,
    earned: answers.reduce((total, answer) => total + VALUE_OF[answer], 0),
  };
}

/**
 * El porcentaje de un día, o `null` si ese día no cuenta.
 *
 * Un día sin envíos no es un cero: es un día que ese hábito no tenía nada que
 * hacer, porque su horario no corre los domingos o porque la biblioteca estaba
 * vacía. Contarlo como cero castigaría al usuario por algo que no hizo mal, y
 * hundiría el promedio de un plan de treinta días con los cuatro fines de
 * semana en los que el horario no dispara.
 */
export function percentOf(score: DayScore): number | null {
  if (score.sent <= 0) return null;

  return round((score.earned / score.sent) * 100);
}

/**
 * El promedio de una lista de porcentajes, saltándose los que no cuentan.
 *
 * Se promedian porcentajes y no archivos, y esa es la diferencia que importa:
 * un hábito de cien fotos y otro de cinco audios pesan lo mismo, porque los dos
 * son un hábito. Sumando archivos, el de cien decidiría el plan él solo.
 */
export function averagePercent(percents: readonly (number | null)[]): number | null {
  const counted = percents.filter((percent): percent is number => percent !== null);

  if (counted.length === 0) return null;

  return round(counted.reduce((total, percent) => total + percent, 0) / counted.length);
}

/** Un decimal. Suficiente para la pantalla y para el chat, y estable al sumar. */
function round(value: number): number {
  return Math.round(value * 10) / 10;
}
