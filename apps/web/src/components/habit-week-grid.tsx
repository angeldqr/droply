'use client';

import { appliesOn, dayIn, dayScore, isPausedOn, type HabitView } from '@reconectate/contracts';
import { BAND_TONE, bandOf, Legend } from '@/components/habit-plan-grid';
import { WEEKDAY_NAMES } from '@/components/habit-mark';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSession } from '@/lib/session';

/** Lo que muestra una casilla de la semana. */
type Cell =
  | { kind: 'score'; percent: number }
  /** Hoy, todavía sin cumplir: se puede cumplir, así que no se pinta como fallo. */
  | { kind: 'open'; percent: number }
  /** El hábito no tocaba ese día, o estaba en pausa. */
  | { kind: 'free' }
  /** Todavía no llega, o el hábito aún no existía. */
  | { kind: 'none' };

/**
 * La evaluación de la semana: una fila por hábito y una casilla por día, de
 * lunes a domingo, con el porcentaje de la meta de cada día.
 *
 * Las casillas son más grandes que las de la rejilla del plan: aquí son siete
 * por fila y no treinta, así que hay sitio para que se lean de lejos.
 *
 * La columna «Semana» promedia solo los días que contaban: un día libre no
 * castiga, y hoy entra únicamente si ya se cumplió —igual que la tendencia del
 * detalle—, para que la semana no se vea peor por la tarde de lo que es.
 */
export function HabitWeekGrid({ habits }: { habits: readonly HabitView[] }) {
  const { user } = useSession();

  // Sin la zona de la cuenta no se sabe en qué día nació cada hábito; la página
  // ya está detrás de la sesión, así que esto dura un instante.
  if (!user) return null;

  const timezone = user.timezone;

  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-x-auto pb-1">
        <div className="min-w-fit">
          <div className="flex items-end gap-1.5 pl-[9.875rem]" aria-hidden>
            {WEEKDAY_NAMES.map((name) => (
              <span
                key={name.long}
                className="text-muted-foreground w-12.5 text-center text-base font-medium uppercase"
              >
                {name.narrow}
              </span>
            ))}
            <span className="text-muted-foreground w-20 pl-3 text-right text-xs font-medium">
              Semana
            </span>
          </div>

          <div className="mt-1.5 flex flex-col gap-1.5">
            {habits.map((habit) => (
              <WeekRow
                key={habit.id}
                habit={habit}
                since={dayIn(timezone, new Date(habit.createdAt))}
              />
            ))}
          </div>
        </div>
      </div>

      <Legend empty="Día libre" />
    </div>
  );
}

function WeekRow({ habit, since }: { habit: HabitView; since: string }) {
  const cells = habit.week.map((day) => cellOf(habit, day.day, day.count, since));
  const counted = cells.filter((cell) => cell.kind === 'score');
  const week =
    counted.length === 0
      ? null
      : Math.round(counted.reduce((sum, cell) => sum + cell.percent, 0) / counted.length);

  return (
    <div className="flex items-center gap-1.5">
      <span className="w-38 shrink-0 truncate pr-2 text-sm" title={habit.name}>
        {habit.name}
      </span>

      {cells.map((cell, index) => (
        <WeekCell
          key={habit.week[index]?.day ?? index}
          cell={cell}
          label={describe(habit.name, index, cell)}
        />
      ))}

      <span className="w-20 shrink-0 pl-3 text-right font-mono text-sm font-semibold tabular-nums">
        {week === null ? '—' : `${week}%`}
      </span>
    </div>
  );
}

function cellOf(habit: HabitView, day: string, count: number, since: string): Cell {
  if (day > habit.today || day < since) return { kind: 'none' };
  if (!appliesOn(habit.activeDays, day) || isPausedOn(habit.pauses, day)) return { kind: 'free' };

  const percent = Math.round(dayScore(count, habit.dailyTarget) * 100);

  if (day === habit.today && percent < 100) return { kind: 'open', percent };

  return { kind: 'score', percent };
}

function WeekCell({ cell, label }: { cell: Cell; label: string }) {
  const tone =
    cell.kind === 'score'
      ? BAND_TONE[bandOf(cell.percent)]
      : cell.kind === 'open'
        ? 'border-logro text-foreground border border-dashed'
        : cell.kind === 'free'
          ? 'bg-muted text-muted-foreground text-sm font-normal'
          : 'bg-muted/50';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`w-12.5 grid h-10 shrink-0 place-items-center rounded-md font-mono text-base font-semibold tabular-nums ${tone}`}
          aria-label={label}
        >
          {cell.kind === 'score' || cell.kind === 'open'
            ? cell.percent
            : cell.kind === 'free'
              ? 'libre'
              : ''}
        </div>
      </TooltipTrigger>

      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function describe(name: string, index: number, cell: Cell): string {
  const day = `${name}, ${WEEKDAY_NAMES[index]?.long ?? ''}`;

  switch (cell.kind) {
    case 'score':
      return `${day}: ${cell.percent}%`;
    case 'open':
      return `${day}: hoy, ${cell.percent}% por ahora`;
    case 'free':
      return `${day}: día libre`;
    case 'none':
      return `${day}: no cuenta`;
  }
}
