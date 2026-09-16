'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { dayKey } from '@/components/habit-mark';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Lunes primero, como se lee un calendario en español. El 5 de enero de 2026 fue lunes. */
const WEEKDAYS = Array.from({ length: 7 }, (_, index) =>
  new Date(2026, 0, 5 + index).toLocaleDateString('es', { weekday: 'narrow' }),
);

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, step: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + step, 1);
}

/** El tono según cuántas anotaciones hubo: la misma escala morada de la app. */
function toneOf(count: number): string {
  if (count >= 3) return 'bg-morado-700 text-papel font-bold';
  if (count === 2) return 'bg-morado-400 text-ciruela-900 font-bold';

  return 'bg-lavanda-300 text-ciruela-900 font-semibold';
}

function labelOf(date: Date, count: number): string {
  const day = date.toLocaleDateString('es', { day: 'numeric', month: 'long' });

  if (count === 0) return `${day}: sin anotaciones`;

  return `${day}: ${count} ${count === 1 ? 'anotación' : 'anotaciones'}`;
}

/**
 * Un mes con los días en que se anotó algo.
 *
 * Sin porcentajes ni rachas: solo dónde hay algo escrito. Tocar un día marcado
 * baja el diario hasta ese día. Empieza en el mes actual y se puede ir hacia
 * atrás hasta el de la primera anotación.
 *
 * `days` va de la clave del día (`dayKey`) a cuántas anotaciones tuvo.
 */
export function HabitCalendar({
  days,
  firstDay,
}: {
  days: ReadonlyMap<string, number>;
  firstDay: Date;
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

    return { date, key, count: days.get(key) ?? 0 };
  });

  const marked = cells.filter((cell) => cell.count > 0).length;
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
        {WEEKDAYS.map((weekday, index) => (
          <span
            key={index}
            aria-hidden
            className="text-muted-foreground pb-1 text-[0.7rem] font-semibold uppercase"
          >
            {weekday}
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

          return cell.count > 0 ? (
            <button
              key={cell.key}
              type="button"
              onClick={() => jumpTo(cell.key)}
              aria-label={labelOf(cell.date, cell.count)}
              className={cn(
                base,
                toneOf(cell.count),
                'focus-visible:ring-ring transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none motion-reduce:hover:scale-100',
              )}
            >
              {cell.date.getDate()}
            </button>
          ) : (
            // Un `span` no lleva `aria-label` que se lea: el texto va oculto a la vista.
            <span key={cell.key} className={cn(base, 'text-muted-foreground')}>
              <span aria-hidden>{cell.date.getDate()}</span>
              <span className="sr-only">{labelOf(cell.date, 0)}</span>
            </span>
          );
        })}
      </div>

      <p className="text-muted-foreground text-xs">
        {marked === 0
          ? 'Ningún día con anotación este mes'
          : `${marked} ${marked === 1 ? 'día' : 'días'} con anotación este mes`}
      </p>
    </section>
  );
}
