'use client';

import type { HabitDayView, HabitProgressView } from '@reconectate/contracts';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * La rejilla del plan: una fila por hábito, una casilla por día.
 *
 * Es CSS y nada más —sin librería de gráficas— porque lo que hay que enseñar es
 * una tabla de números pequeños con un color detrás, y eso ya sabe hacerlo el
 * navegador. Traer `recharts` para pintar cuadrados sería cargar doscientos
 * kilobytes para reimplementar un `grid`.
 *
 * **El color nunca va solo.** Cada casilla lleva su número dentro y su
 * `aria-label`, así que la rejilla sigue leyéndose sin distinguir el verde del
 * rojo. Es la única regla que no se negocia acá.
 */
export function HabitPlanGrid({
  habits,
  durationDays,
}: {
  habits: readonly HabitProgressView[];
  durationDays: number;
}) {
  return (
    <div className="flex flex-col gap-6">
      {/*
        La rejilla desborda a lo ancho con treinta días, así que scrollea dentro
        de su propia caja. Sin esto, la página entera se movería en horizontal
        en el teléfono y el resto de la pantalla se saldría con ella.
      */}
      <div className="overflow-x-auto pb-1">
        <div className="min-w-fit">
          <DayRuler durationDays={durationDays} />

          <div className="mt-1 flex flex-col gap-1">
            {habits.map((habit) => (
              <HabitRow key={habit.libraryId} habit={habit} durationDays={durationDays} />
            ))}
          </div>
        </div>
      </div>

      <Legend />
    </div>
  );
}

/** La regleta de arriba. Solo se numeran los múltiplos de cinco y el uno. */
function DayRuler({ durationDays }: { durationDays: number }) {
  return (
    <div className="flex items-end gap-1 pl-[9.5rem]">
      {Array.from({ length: durationDays }, (_unused, index) => index + 1).map((number) => (
        <span
          key={number}
          className="text-muted-foreground w-7 text-center font-mono text-[10px] tabular-nums"
          aria-hidden
        >
          {number === 1 || number % 5 === 0 ? number : ''}
        </span>
      ))}
    </div>
  );
}

function HabitRow({ habit, durationDays }: { habit: HabitProgressView; durationDays: number }) {
  return (
    <div className="flex items-center gap-1">
      <span className="w-38 shrink-0 truncate pr-2 text-sm" title={habit.label}>
        {habit.label}
      </span>

      {Array.from({ length: durationDays }, (_unused, index) => (
        <DayCell key={index} day={habit.days[index]} number={index + 1} label={habit.label} />
      ))}

      <span className="text-muted-foreground w-16 shrink-0 pl-3 text-right font-mono text-xs tabular-nums">
        {habit.percent === null ? '—' : `${habit.percent}%`}
      </span>
    </div>
  );
}

/**
 * Una casilla.
 *
 * Un día sin envíos no es un cero: es un día en el que ese hábito no tenía nada
 * que hacer, porque el horario no corre los domingos o la biblioteca estaba
 * vacía. Se pinta como hueco y se dice así en el globo, en vez de teñirlo de
 * rojo y dar a entender un fallo que no hubo.
 */
function DayCell({
  day,
  number,
  label,
}: {
  day: HabitDayView | undefined;
  number: number;
  label: string;
}) {
  const pending = !day || day.percent === null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`grid size-7 shrink-0 place-items-center rounded font-mono text-[10px] tabular-nums ${toneOf(day)}`}
          aria-label={describe(label, number, day)}
        >
          {pending ? '' : Math.round(day.percent ?? 0)}
        </div>
      </TooltipTrigger>

      <TooltipContent>{describe(label, number, day)}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Los tres colores, con los cortes donde importan.
 *
 * Ochenta es el listón de un día bueno y cincuenta el de un día a medias — que
 * es justo lo que vale el botón del medio, así que un día entero respondido «a
 * medias» cae en ámbar y no en rojo.
 */
function toneOf(day: HabitDayView | undefined): string {
  if (!day || day.percent === null) return 'bg-lavanda-200/60 text-transparent';
  if (day.percent >= 80) return 'bg-logro-600 text-white';
  if (day.percent >= 50) return 'bg-medias-500 text-white';

  return 'bg-alerta-500 text-white';
}

function describe(label: string, number: number, day: HabitDayView | undefined): string {
  if (!day || day.percent === null) return `${label}, día ${number}: sin envíos`;

  return `${label}, día ${number}: ${day.percent}%, ${day.answered} de ${day.sent} respondidos`;
}

function Legend() {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
      <Swatch className="bg-logro-600">80% o más</Swatch>
      <Swatch className="bg-medias-500">Entre 50 y 79%</Swatch>
      <Swatch className="bg-alerta-500">Menos de 50%</Swatch>
      <Swatch className="bg-lavanda-200">Sin envíos ese día</Swatch>
    </div>
  );
}

function Swatch({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`size-3 rounded-sm ${className}`} aria-hidden />
      {children}
    </span>
  );
}

/** La barra del plan entero, que es el promedio de sus hábitos. */
export function PlanProgress({ percent }: { percent: number | null }) {
  return (
    <div className="flex items-center gap-3">
      <Progress value={percent ?? 0} className="h-2 flex-1" />
      <span className="w-16 text-right font-mono text-sm tabular-nums">
        {percent === null ? 'Sin datos' : `${percent}%`}
      </span>
    </div>
  );
}
