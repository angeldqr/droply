import { ALL_DAYS, WEEKDAYS_ONLY } from '@reconectate/contracts';
import { cn } from '@/lib/utils';

/**
 * Los cuatro tonos de la familia, de claro a oscuro.
 *
 * Cada hábito se queda siempre con el mismo —sale de su identificador, no de su
 * posición—, así que reordenar o borrar otro no le cambia el color a nadie.
 */
const TONES = [
  'bg-lavanda-200 text-ciruela-900',
  'bg-lavanda-300 text-ciruela-900',
  'bg-morado-400 text-ciruela-900',
  'bg-morado-700 text-papel',
];

function toneOf(id: string): string {
  let sum = 0;

  for (const char of id) sum += char.charCodeAt(0);

  return TONES[sum % TONES.length] ?? 'bg-lavanda-200 text-ciruela-900';
}

/** La inicial del hábito en su tono: lo que lo hace reconocible de un vistazo. */
export function HabitMark({
  id,
  name,
  className,
}: {
  id: string;
  name: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'font-display grid size-11 shrink-0 place-items-center rounded-xl text-lg font-bold',
        toneOf(id),
        className,
      )}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Medianoche local de ese instante, para contar días de calendario y no de 24 h. */
function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Cuántos días de calendario van de `iso` a hoy. */
export function daysAgo(iso: string, now = new Date()): number {
  return Math.round((startOfDay(now) - startOfDay(new Date(iso))) / DAY_MS);
}

/** «hoy», «ayer», «hace 3 días»; pasado un mes, la fecha. */
export function whenRelative(iso: string): string {
  const days = daysAgo(iso);

  if (days > 30) {
    return `el ${new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' })}`;
  }

  return new Intl.RelativeTimeFormat('es', { numeric: 'auto' }).format(-days, 'day');
}

/** Baja el diario hasta ese día. Lo usan el calendario del mes y el del año. */
export function jumpToDay(key: string): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document
    .getElementById(`dia-${key}`)
    ?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
}

/** «1 anotación», «3 anotaciones». */
export function cuenta(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** `2026-09-16`, en la fecha local: la clave de un día en el diario y el calendario. */
export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

/** Lunes primero, como se lee una semana en español. El 5 de enero de 2026 fue lunes. */
export const WEEKDAY_NAMES = Array.from({ length: 7 }, (_, index) => {
  const date = new Date(2026, 0, 5 + index);

  return {
    narrow: date.toLocaleDateString('es', { weekday: 'narrow' }),
    short: date.toLocaleDateString('es', { weekday: 'short' }).replace('.', ''),
    long: date.toLocaleDateString('es', { weekday: 'long' }),
  };
});

/** «2 veces al día · de lunes a viernes», dicho como lo diría una persona. */
export function goalLabel(dailyTarget: number, activeDays: number): string {
  const times = dailyTarget === 1 ? 'Una vez al día' : `${dailyTarget} veces al día`;

  return `${times} · ${daysLabel(activeDays)}`;
}

function daysLabel(activeDays: number): string {
  if (activeDays === ALL_DAYS) return 'todos los días';
  if (activeDays === WEEKDAYS_ONLY) return 'de lunes a viernes';
  if (activeDays === ALL_DAYS - WEEKDAYS_ONLY) return 'fines de semana';

  return WEEKDAY_NAMES.filter((_, index) => (activeDays & (1 << index)) !== 0)
    .map((day) => day.short)
    .join(', ');
}
