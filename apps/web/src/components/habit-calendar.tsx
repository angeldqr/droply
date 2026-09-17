'use client';

import { appliesOn, dayScore, type HabitGoal } from '@reconectate/contracts';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { dayKey, WEEKDAY_NAMES } from '@/components/habit-mark';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, step: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + step, 1);
}

/** Cumplido en el morado fuerte de la app; a medias, en el claro. */
function toneOf(score: number): string {
  return score === 1
    ? 'bg-morado-700 text-papel font-bold'
    : 'bg-lavanda-300 text-ciruela-900 font-semibold';
}

function labelOf(date: Date, count: number, goal: HabitGoal, applies: boolean): string {
  const day = date.toLocaleDateString('es', { day: 'numeric', month: 'long' });

  if (!applies) return `${day}: día libre${count > 0 ? `, ${count} anotadas` : ''}`;

  return `${day}: ${count} de ${goal.dailyTarget}`;
}

/**
 * Un mes con cómo fue cada día frente a la meta.
 *
 * Lleno si se cumplió, claro si quedó a medias, apagado si ese día no tocaba.
 * Tocar un día anotado baja el diario hasta él. Empieza en el mes actual y se
 * puede ir hacia atrás hasta el de la primera anotación.
 *
 * `days` va de la clave del día (`dayKey`) a cuántas anotaciones tuvo.
 */
export function HabitCalendar({
  days,
  firstDay,
  goal,
}: {
  days: ReadonlyMap<string, number>;
  firstDay: Date;
  goal: HabitGoal;
}) {
  const today = new Date();
  const [month, setMonth] = useState(() => monthStart(today));

  const canGoBack = month > monthStart(firstDay);
  const canGoForward = month < monthStart(today);

  // Cuántas casillas vacías van antes del día 1, con la semana empezando en lunes.
  const offset = (month.getDay() + 6) % 7;
  const length = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length }, (_, index) => {
    const date = new Date(month.getFullYear(), month.getMonth(), index + 1);
    const key = dayKey(date);

    const count = days.get(key) ?? 0;

    return {
      date,
      key,
      count,
      applies: appliesOn(goal.activeDays, key),
      score: dayScore(count, goal.dailyTarget),
    };
  });

  const met = cells.filter((cell) => cell.applies && cell.score === 1).length;
  const todayKey = dayKey(today);

  function jumpTo(key: string): void {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    document
      .getElementById(`dia-${key}`)
      ?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }

  return (
    <section
      aria-label="Calendario de anotaciones"
      className="bg-card border-border flex flex-col gap-3 rounded-2xl border p-4"
    >
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => setMonth((current) => addMonths(current, -1))}
          disabled={!canGoBack}
          aria-label="Mes anterior"
        >
          <ChevronLeft />
        </Button>

        <h2 className="font-display text-sm font-bold first-letter:uppercase" aria-live="polite">
          {month.toLocaleDateString('es', { month: 'long', year: 'numeric' })}
        </h2>

        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => setMonth((current) => addMonths(current, 1))}
          disabled={!canGoForward}
          aria-label="Mes siguiente"
        >
          <ChevronRight />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_NAMES.map((weekday, index) => (
          <span
            key={weekday.long}
            aria-hidden
            className={cn(
              'pb-1 text-[0.7rem] font-semibold uppercase',
              (goal.activeDays & (1 << index)) === 0
                ? 'text-muted-foreground/50'
                : 'text-muted-foreground',
            )}
          >
            {weekday.narrow}
          </span>
        ))}

        {Array.from({ length: offset }, (_, index) => (
          <span key={`vacio-${index}`} aria-hidden />
        ))}

        {cells.map((cell) => {
          const base = cn(
            'grid aspect-square place-items-center rounded-lg text-xs tabular-nums',
            cell.key === todayKey && 'ring-primary ring-offset-card ring-2 ring-offset-1',
          );
          const label = labelOf(cell.date, cell.count, goal, cell.applies);

          return cell.count > 0 ? (
            <button
              key={cell.key}
              type="button"
              onClick={() => jumpTo(cell.key)}
              aria-label={label}
              className={cn(
                base,
                // Anotar en un día libre se ve, pero sin la escala de la meta.
                cell.applies
                  ? toneOf(cell.score)
                  : 'border-lavanda-300 text-ciruela-900 border-2 border-dashed font-semibold',
                'focus-visible:ring-ring transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none motion-reduce:hover:scale-100',
              )}
            >
              {cell.date.getDate()}
            </button>
          ) : (
            // Un `span` no lleva `aria-label` que se lea: el texto va oculto a la vista.
            <span
              key={cell.key}
              className={cn(
                base,
                cell.applies ? 'text-muted-foreground' : 'text-muted-foreground/40',
              )}
            >
              <span aria-hidden>{cell.date.getDate()}</span>
              <span className="sr-only">{label}</span>
            </span>
          );
        })}
      </div>

      <p className="text-muted-foreground text-xs">
        {met === 0
          ? 'Ningún día cumplido este mes'
          : `${met} ${met === 1 ? 'día cumplido' : 'días cumplidos'} este mes`}
      </p>
    </section>
  );
}
