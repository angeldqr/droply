'use client';

import {
  addDays,
  appliesOn,
  dayScore,
  isPausedOn,
  weekdayOf,
  type HabitGoal,
  type HabitPauseRange,
} from '@reconectate/contracts';
import { dayKey } from '@/components/habit-mark';
import { cn } from '@/lib/utils';

/** Cuántas semanas se comparan. Tres meses: suficiente para ver si va mejorando. */
const WEEKS = 12;

interface Week {
  readonly monday: string;
  readonly label: string;
  /** De 0 a 1, o `null` si esa semana no pedía nada (libre, en pausa o antes de crearlo). */
  readonly rate: number | null;
}

function weeksOf(input: {
  days: ReadonlyMap<string, number>;
  goal: HabitGoal;
  pauses: readonly HabitPauseRange[];
  since: string;
  today: string;
}): Week[] {
  const thisMonday = addDays(input.today, -weekdayOf(input.today));

  return Array.from({ length: WEEKS }, (_, index) => {
    const monday = addDays(thisMonday, (index - (WEEKS - 1)) * 7);
    let scored = 0;
    let total = 0;

    for (let day = 0; day < 7; day += 1) {
      const key = addDays(monday, day);

      if (key < input.since || key > input.today) continue;
      if (!appliesOn(input.goal.activeDays, key) || isPausedOn(input.pauses, key)) continue;

      // El día de hoy todavía se puede cumplir: solo cuenta si ya se cumplió.
      const score = dayScore(input.days.get(key) ?? 0, input.goal.dailyTarget);

      if (key === input.today && score < 1) continue;

      total += score;
      scored += 1;
    }

    return {
      monday,
      label: new Date(`${monday}T12:00:00`).toLocaleDateString('es', {
        day: 'numeric',
        month: 'short',
      }),
      rate: scored === 0 ? null : total / scored,
    };
  });
}

/**
 * Cómo fue cada una de las últimas doce semanas.
 *
 * Una sola serie, así que no lleva leyenda: el título dice qué se está mirando
 * y cada barra su porcentaje. Las semanas sin nada que cumplir salen vacías en
 * vez de en cero, que sería decir que se falló.
 */
export function HabitTrend({
  days,
  goal,
  pauses,
  since,
}: {
  days: ReadonlyMap<string, number>;
  goal: HabitGoal;
  pauses: readonly HabitPauseRange[];
  since: string;
}) {
  const today = dayKey(new Date());
  const weeks = weeksOf({ days, goal, pauses, since, today });
  const medidas = weeks.filter((week) => week.rate !== null);

  if (medidas.length < 2) return null;

  return (
    <figure className="flex flex-col gap-3">
      <figcaption>
        <h3 className="text-base font-medium">Semana a semana</h3>
        <p className="text-muted-foreground text-sm">
          Cuánto de la meta se cumplió cada semana, de lunes a domingo.
        </p>
      </figcaption>

      <ol className="flex h-52 items-end gap-2">
        {weeks.map((week, index) => {
          const pct = week.rate === null ? null : Math.round(week.rate * 100);
          const last = index === weeks.length - 1;

          return (
            <li
              key={week.monday}
              className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1.5"
            >
              {/* El porcentaje sobre su barra: se lee sin pasar el cursor. */}
              <span
                aria-hidden
                className={cn(
                  'text-center font-mono text-xs tabular-nums',
                  last ? 'text-foreground font-medium' : 'text-muted-foreground',
                )}
              >
                {/* Los ceros no se rotulan: una fila de «0%» tapa la semana que sí cuenta. */}
                {pct === null || (pct === 0 && !last) ? '' : `${pct}%`}
              </span>
              <span
                className={cn(
                  'w-full rounded-t-[0.5rem]',
                  pct === null ? 'bg-muted' : last ? 'bg-menta' : 'bg-menta/45',
                )}
                style={{ height: `${pct === null ? 3 : Math.max(pct, 3)}%` }}
                title={
                  pct === null
                    ? `Semana del ${week.label}: sin días que contaran`
                    : `Semana del ${week.label}: ${pct} %`
                }
                aria-hidden
              />
              <span className="sr-only">
                {pct === null
                  ? `Semana del ${week.label}: sin días que contaran`
                  : `Semana del ${week.label}: ${pct} por ciento`}
              </span>
            </li>
          );
        })}
      </ol>

      {/*
        La fecha de cada semana bajo su barra, una sí y una no: todas juntas no
        caben. La última siempre, que es esta semana.
      */}
      <div aria-hidden className="text-muted-foreground flex gap-2 text-xs">
        {weeks.map((week, index) => {
          const last = index === weeks.length - 1;

          return (
            <span
              key={week.monday}
              className={cn(
                'min-w-0 flex-1 truncate text-center',
                last && 'text-foreground font-medium',
              )}
            >
              {last ? 'Esta' : (weeks.length - 1 - index) % 2 === 0 ? week.label : ''}
            </span>
          );
        })}
      </div>
    </figure>
  );
}
