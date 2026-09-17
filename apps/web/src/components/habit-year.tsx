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

/** Un año cabe en 53 columnas de siete días. */
const MAX_WEEKS = 53;

/** El tono de un día, en la misma escala morada del calendario del mes. */
function toneOf(score: number, applies: boolean): string {
  if (!applies) return 'bg-muted';
  if (score === 1) return 'bg-morado-700';
  if (score > 0) return 'bg-lavanda-300';

  return 'border-border border';
}

function labelOf(key: string, count: number, target: number, applies: boolean): string {
  const día = new Date(`${key}T12:00:00`).toLocaleDateString('es', {
    day: 'numeric',
    month: 'long',
  });

  return applies ? `${día}: ${count} de ${target}` : `${día}: no contaba`;
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
      <p className="text-muted-foreground text-xs">
        Cada columna es una semana; cada cuadrito, un día.
      </p>

      <div className="flex gap-2">
        {/* Las iniciales de los días, para saber qué fila se está mirando. */}
        <ul aria-hidden className="text-muted-foreground mt-5 flex flex-col gap-1 text-[0.6rem]">
          {WEEKDAY_NAMES.map((day) => (
            <li key={day.long} className="h-3 leading-3">
              {day.narrow}
            </li>
          ))}
        </ul>

        <div ref={tira} className="flex gap-1 overflow-x-auto pb-1">
          {weeks.map((week) => (
            <div key={week.monday} className="flex shrink-0 flex-col gap-1">
              {/* El mes cuelga de su columna: nunca hay dos a menos de cuatro. */}
              <span aria-hidden className="relative h-4 w-3">
                <span className="text-muted-foreground absolute left-0 top-0 whitespace-nowrap text-[0.65rem]">
                  {week.month}
                </span>
              </span>

              {week.days.map((cell) => {
                const base = cn(
                  'block size-3 rounded-[3px]',
                  cell.outside ? 'invisible' : toneOf(cell.score, cell.applies),
                  cell.key === today && 'ring-primary ring-1 ring-offset-1',
                );

                if (cell.outside || cell.count === 0) {
                  // Sin nada anotado no hay qué leer ni a dónde saltar: el
                  // resumen de abajo dice lo mismo sin trescientas etiquetas.
                  return <span key={cell.key} aria-hidden className={base} />;
                }

                const label = labelOf(cell.key, cell.count, goal.dailyTarget, cell.applies);

                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => jumpToDay(cell.key)}
                    title={label}
                    aria-label={label}
                    className={cn(
                      base,
                      'focus-visible:ring-ring transition-transform hover:scale-125 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none motion-reduce:hover:scale-100',
                    )}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs">
        <p>
          {met.length === 0
            ? 'Ningún día cumplido todavía'
            : `${cuenta(met.length, 'día cumplido', 'días cumplidos')}`}
        </p>

        {/* La leyenda, con la misma escala: sin ella los tonos no dicen nada. */}
        <p className="flex items-center gap-1.5">
          <span className="border-border size-3 rounded-[3px] border" aria-hidden />
          <span>Nada</span>
          <span className="bg-lavanda-300 size-3 rounded-[3px]" aria-hidden />
          <span>A medias</span>
          <span className="bg-morado-700 size-3 rounded-[3px]" aria-hidden />
          <span>Cumplido</span>
          <span className="bg-muted size-3 rounded-[3px]" aria-hidden />
          <span>No tocaba</span>
        </p>
      </div>
    </section>
  );
}
