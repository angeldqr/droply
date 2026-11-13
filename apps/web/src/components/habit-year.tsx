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
import { useEffect, useRef } from 'react';
import { cuenta, dayKey, jumpToDay, WEEKDAY_NAMES } from '@/components/habit-mark';
import { cn } from '@/lib/utils';

/** Lo que quiere decir cada tono, con los mismos de los cuadros. */
const LEGEND = [
  { tone: 'border-border border', label: 'Nada' },
  { tone: 'bg-menta/35', label: 'A medias' },
  { tone: 'bg-menta', label: 'Cumplido' },
  { tone: 'bg-muted', label: 'No tocaba' },
] as const;

/** Un año cabe en 53 columnas de siete días. */
const MAX_WEEKS = 53;

/** El tono de un día, con su tinta, en la misma escala menta del calendario del mes. */
function toneOf(score: number, applies: boolean): string {
  if (!applies) return 'bg-muted text-muted-foreground/70';
  if (score === 1) return 'bg-menta text-sobre-menta font-semibold';
  if (score > 0) return 'bg-menta/35 text-foreground';

  return 'border-border text-muted-foreground border';
}

function labelOf(key: string, count: number, target: number, applies: boolean): string {
  const día = new Date(`${key}T12:00:00`).toLocaleDateString('es', {
    day: 'numeric',
    month: 'long',
  });

  return applies ? `${día}: ${count} de ${target} veces` : `${día}: ese día no tocaba`;
}

/** «sep», «oct»: el nombre corto, sin el punto que le pone el navegador. */
function monthOf(key: string): string {
  return new Date(`${key}T12:00:00`).toLocaleDateString('es', { month: 'short' }).replace('.', '');
}

/**
 * El historial del hábito, una columna por semana.
 *
 * Es el panorama que el calendario del mes no da: de un vistazo se ve si el
 * hábito se sostiene o si se cae por temporadas. Cada cuadrito es un día —los
 * de arriba son lunes— y el tono dice cómo fue frente a la meta.
 *
 * Empieza en la semana en que se creó el hábito, no un año atrás: media
 * pantalla en blanco no cuenta nada. Las columnas van en orden, de la más
 * vieja a hoy —también para quien lo lee con el teclado—, y la tira arranca
 * desplazada hasta el final, que es donde está lo de esta semana.
 */
export function HabitYear({
  days,
  goal,
  pauses,
  since,
}: {
  days: ReadonlyMap<string, number>;
  goal: HabitGoal;
  pauses: readonly HabitPauseRange[];
  /** El día en que se creó el hábito: antes no había nada que cumplir. */
  since: string;
}) {
  const tira = useRef<HTMLDivElement>(null);
  const today = dayKey(new Date());
  const thisMonday = addDays(today, -weekdayOf(today));
  const firstMonday = addDays(since, -weekdayOf(since));

  // Desde la semana en que nació el hábito, y como mucho un año.
  const length = Math.min(
    MAX_WEEKS,
    Math.round((Date.parse(thisMonday) - Date.parse(firstMonday)) / (7 * 24 * 60 * 60 * 1000)) + 1,
  );
  const start = addDays(thisMonday, -(length - 1) * 7);

  const weeks = Array.from({ length }, (_, week) => {
    const monday = addDays(start, week * 7);

    return {
      monday,
      // El nombre del mes va en la columna donde ese mes empieza.
      month: week === 0 || monthOf(monday) !== monthOf(addDays(monday, -7)) ? monthOf(monday) : '',
      days: Array.from({ length: 7 }, (_, day) => {
        const key = addDays(monday, day);
        const count = days.get(key) ?? 0;

        return {
          key,
          count,
          // Fuera del hábito: antes de crearlo o todavía por venir.
          outside: key < since || key > today,
          applies: appliesOn(goal.activeDays, key) && !isPausedOn(pauses, key),
          score: dayScore(count, goal.dailyTarget),
        };
      }),
    };
  });

  const met = weeks
    .flatMap((week) => week.days)
    .filter((cell) => !cell.outside && cell.applies && cell.score === 1);

  useEffect(() => {
    // Lo primero que importa es lo de ahora, que está al final de la tira.
    if (tira.current) tira.current.scrollLeft = tira.current.scrollWidth;
  }, []);

  return (
    <section aria-label="Historial por semanas" className="flex flex-col gap-3">
      <div>
        <h3 className="text-base font-medium">Día por día</h3>
        <p className="text-muted-foreground text-sm">
          Cada columna es una semana, de lunes a domingo, y cada cuadro lleva su número de día. Toca
          un día con anotaciones para ir a ellas.
        </p>
      </div>

      <div className="flex gap-2">
        {/* Las iniciales de los días, para saber qué fila se está mirando. */}
        <ul aria-hidden className="text-muted-foreground mt-6 flex flex-col gap-1.5 text-xs">
          {WEEKDAY_NAMES.map((day) => (
            <li key={day.long} className="h-7 leading-7">
              {day.narrow}
            </li>
          ))}
        </ul>

        <div ref={tira} className="-m-1 flex gap-1.5 overflow-x-auto p-1">
          {weeks.map((week) => (
            <div key={week.monday} className="flex shrink-0 flex-col gap-1.5">
              {/* El mes cuelga de su columna: nunca hay dos a menos de cuatro. */}
              <span aria-hidden className="h-4.5 relative w-7">
                <span className="text-muted-foreground absolute left-0 top-0 whitespace-nowrap text-xs capitalize">
                  {week.month}
                </span>
              </span>

              {week.days.map((cell) => {
                const base = cn(
                  'grid size-7 place-items-center rounded-[0.4rem] font-mono text-[0.7rem] tabular-nums',
                  cell.outside ? 'invisible' : toneOf(cell.score, cell.applies),
                  cell.key === today && 'ring-foreground ring-2 ring-inset',
                );
                // El número del día dentro del cuadro: sin él no se sabe qué fecha es cuál.
                const number = Number(cell.key.slice(8));
                const label = labelOf(cell.key, cell.count, goal.dailyTarget, cell.applies);

                if (cell.outside || cell.count === 0) {
                  // Sin nada anotado no hay a dónde saltar: la fecha se ve al
                  // pasar el cursor, y el resumen de abajo la cuenta sin
                  // trescientas etiquetas para el lector de pantalla.
                  return (
                    <span
                      key={cell.key}
                      aria-hidden
                      title={cell.outside ? undefined : label}
                      className={base}
                    >
                      {cell.outside ? '' : number}
                    </span>
                  );
                }

                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => jumpToDay(cell.key)}
                    title={label}
                    aria-label={label}
                    className={cn(
                      base,
                      'focus-visible:ring-ring transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none motion-reduce:hover:scale-100',
                    )}
                  >
                    {number}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-sm">
        <p>
          {met.length === 0
            ? 'Ningún día cumplido todavía'
            : `${cuenta(met.length, 'día cumplido', 'días cumplidos')}`}
        </p>

        {/* La leyenda, con la misma escala: sin ella los tonos no dicen nada. */}
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {LEGEND.map((item) => (
            <span key={item.label} className="flex items-center gap-1.5">
              <span className={cn('size-4 rounded-[0.3rem]', item.tone)} aria-hidden />
              {item.label}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
