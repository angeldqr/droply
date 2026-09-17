'use client';

import {
  JOURNAL_COMMAND,
  progressOf,
  RATE_WINDOW_DAYS,
  type EntryPhotoView,
  type HabitEntryView,
  type HabitProgress,
} from '@reconectate/contracts';
import { ChevronLeft, ChevronRight, NotebookPen, Play, Trash2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { AppShell } from '@/components/app-shell';
import { HabitCalendar } from '@/components/habit-calendar';
import { cuenta, dayKey, daysAgo, goalLabel, HabitMark } from '@/components/habit-mark';
import { RequireSession } from '@/components/require-session';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { ApiError } from '@/lib/api';
import { useDeleteEntry, useHabitEntries, useHabits, useResumeHabit } from '@/lib/journal';
import { cn } from '@/lib/utils';

export default function HabitPage() {
  const params = useParams<{ habitId: string }>();

  return (
    <RequireSession>
      <Contents habitId={params.habitId} />
    </RequireSession>
  );
}

function Contents({ habitId }: { habitId: string }) {
  const habits = useHabits();
  const entries = useHabitEntries(habitId);
  const habit = habits.data?.find((row) => row.id === habitId);
  const name = habit?.name ?? 'Hábito';
  const list = entries.data ?? [];
  const photoCount = list.reduce((sum, entry) => sum + entry.photos.length, 0);
  const perDay = new Map<string, number>();
  let counted = 0;

  for (const entry of list) {
    // La que se acaba de abrir y está vacía todavía no es una vez.
    if (entry.note === null && entry.photos.length === 0) continue;

    const key = dayKey(new Date(entry.openedAt));

    perDay.set(key, (perDay.get(key) ?? 0) + 1);
    counted += 1;
  }

  // La lista llega de la más reciente a la más vieja: la última es la primera.
  const oldest = list.at(-1);
  const goal = habit ? { dailyTarget: habit.dailyTarget, activeDays: habit.activeDays } : null;
  const progress =
    habit && goal
      ? progressOf({
          perDay,
          goal,
          since: dayKey(new Date(habit.createdAt)),
          today: dayKey(new Date()),
          pauses: habit.pauses,
        })
      : null;
  const openPause = habit?.pauses.find((pause) => pause.to === null);

  return (
    <AppShell crumbs={[{ label: 'Mi bitácora', href: '/habitos' }, { label: name }]}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-4 md:p-6">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_17rem] md:items-start">
          <header className="flex items-center gap-4">
            {habit ? (
              <HabitMark id={habit.id} name={habit.name} className="size-14 text-2xl" />
            ) : (
              <Skeleton className="size-14 rounded-xl" />
            )}

            <div className="min-w-0">
              <h1 className="font-display truncate text-2xl font-bold md:text-3xl">{name}</h1>
              <p className="text-muted-foreground text-sm">
                {habit
                  ? goalLabel(habit.dailyTarget, habit.activeDays)
                  : 'Tu diario de este hábito'}
              </p>
              {counted > 0 ? (
                <p className="text-muted-foreground text-xs">
                  {`${cuenta(counted, 'anotación', 'anotaciones')} · ${cuenta(photoCount, 'foto', 'fotos')}`}
                </p>
              ) : null}
            </div>
          </header>

          {oldest && goal ? (
            <HabitCalendar
              days={perDay}
              firstDay={new Date(oldest.openedAt)}
              goal={goal}
              pauses={habit?.pauses ?? []}
            />
          ) : null}
        </div>

        {habit && openPause ? <PausedNotice habitId={habit.id} since={openPause.from} /> : null}

        {progress && habit ? (
          <ProgressStrip
            progress={progress}
            target={habit.dailyTarget}
            paused={openPause !== undefined}
          />
        ) : null}

        {entries.isPending ? (
          <div className="flex flex-col gap-3">
            {[0, 1].map((index) => (
              <Skeleton key={index} className="h-32 w-full" />
            ))}
          </div>
        ) : entries.error ? (
          <Alert variant="destructive">
            <AlertTitle>No pudimos abrir esta bitácora</AlertTitle>
            <AlertDescription>{entries.error.message}</AlertDescription>
          </Alert>
        ) : entries.data.length === 0 ? (
          <Empty className="border-border border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <NotebookPen />
              </EmptyMedia>
              <EmptyTitle>Nada anotado todavía</EmptyTitle>
              <EmptyDescription>
                Escribe <code className="font-mono">{JOURNAL_COMMAND}</code> en el chat del bot,
                elige «{name}» y cuéntale qué hiciste. Puedes mandarle texto y fotos.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-col gap-8">
            {byDay(entries.data).map((day) => (
              <section
                key={day.key}
                id={`dia-${day.key}`}
                aria-label={day.label}
                className="flex scroll-mt-28 flex-col gap-3"
              >
                <h2 className="bg-background/90 sticky top-14 z-10 -mx-1 flex items-center gap-3 px-1 py-1 backdrop-blur">
                  <span className="font-display text-sm font-bold first-letter:uppercase">
                    {day.label}
                  </span>
                  <span className="bg-border h-px flex-1" aria-hidden />
                </h2>

                <ol className="border-lavanda-300 ml-2 flex flex-col gap-4 border-l-2 pl-5">
                  {day.entries.map((entry) => (
                    <EntryCard key={entry.id} entry={entry} habitId={habitId} />
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

/** El hábito está en pausa: se dice arriba y se puede reanudar ahí mismo. */
function PausedNotice({ habitId, since }: { habitId: string; since: string }) {
  const resume = useResumeHabit(habitId);
  const date = new Date(`${since}T12:00:00`).toLocaleDateString('es', {
    day: 'numeric',
    month: 'long',
  });

  async function onResume(): Promise<void> {
    try {
      await resume.mutateAsync();
      toast.success('Vuelve a contar desde hoy.');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'No se pudo reanudar.');
    }
  }

  return (
    <Alert className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <AlertTitle>En pausa desde el {date}</AlertTitle>
        <AlertDescription>
          Estos días no cuentan como fallo ni cortan tu racha, y el bot no lo ofrece.
        </AlertDescription>
      </div>
      <Button size="sm" onClick={() => void onResume()} disabled={resume.isPending}>
        {resume.isPending ? <Spinner /> : <Play />}
        Reanudar
      </Button>
    </Alert>
  );
}

/**
 * Las tres cifras que responden «¿lo estoy haciendo bien?»: cómo va hoy, cuántos
 * días seguidos van y qué tan parejo fue el último mes.
 */
function ProgressStrip({
  progress,
  target,
  paused,
}: {
  progress: HabitProgress;
  target: number;
  paused: boolean;
}) {
  const tiles = [
    {
      label: 'Hoy',
      value: progress.todayDone
        ? '¡Cumplido!'
        : progress.todayApplies
          ? `${progress.todayCount} de ${target}`
          : paused
            ? 'En pausa'
            : 'Día libre',
      hint: progress.todayDone
        ? `${progress.todayCount} de ${target}`
        : progress.todayApplies
          ? 'veces anotadas'
          : 'hoy no cuenta',
      done: progress.todayDone,
    },
    {
      label: 'Racha',
      value: cuenta(progress.streak, 'día', 'días'),
      hint:
        progress.bestStreak > 0
          ? `La mejor: ${cuenta(progress.bestStreak, 'día', 'días')}`
          : 'Cumple hoy para empezarla',
      done: false,
    },
    {
      label: `Últimos ${RATE_WINDOW_DAYS} días`,
      value: progress.rate === null ? '—' : `${Math.round(progress.rate * 100)} %`,
      hint: progress.rate === null ? 'Todavía no hay días para medir' : 'de la meta cumplida',
      done: false,
    },
  ];

  return (
    <dl className="grid grid-cols-3 gap-2 md:gap-3">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className={cn(
            'bg-card border-border flex flex-col gap-0.5 rounded-2xl border p-3 md:p-4',
            tile.done && 'border-logro-600/40 bg-logro-600/10',
          )}
        >
          <dt className="text-muted-foreground text-[0.7rem] font-semibold uppercase tracking-wide">
            {tile.label}
          </dt>
          <dd
            className={cn(
              'font-display text-lg font-bold tabular-nums md:text-2xl',
              tile.done && 'text-logro-600',
            )}
          >
            {tile.value}
          </dd>
          <dd className="text-muted-foreground text-xs">{tile.hint}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Una anotación. */
function EntryCard({ entry, habitId }: { entry: HabitEntryView; habitId: string }) {
  const remove = useDeleteEntry(habitId);
  const open = entry.closedAt === null;

  async function onDelete(): Promise<void> {
    try {
      await remove.mutateAsync(entry.id);
      toast.success('Anotación borrada.');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'No se pudo borrar.');
    }
  }

  return (
    <li className="group relative">
      {/* El punto sobre la línea del día: marca dónde cae cada anotación. */}
      <span
        aria-hidden
        className={cn(
          'ring-background absolute -left-[27px] top-5 size-3 rounded-full ring-4',
          open ? 'bg-logro-600 motion-safe:animate-pulse' : 'bg-morado-700',
        )}
      />

      <article className="bg-card border-border shadow-xs flex flex-col gap-3 rounded-2xl border p-4 md:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <time className="font-semibold tabular-nums" dateTime={entry.openedAt}>
              {hora(entry.openedAt)}
            </time>

            {/* Abierta quiere decir que todavía le puede caer algo desde el chat. */}
            {open ? <span className="text-logro-600 text-xs font-semibold">· En curso</span> : null}
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive -mr-2 opacity-100 transition-opacity md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100"
                aria-label="Borrar esta anotación"
              >
                <Trash2 />
              </Button>
            </AlertDialogTrigger>

            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Borrar esta anotación?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se borra con sus fotos y no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <AlertDialogFooter>
                <AlertDialogCancel>Dejarla</AlertDialogCancel>
                <AlertDialogAction onClick={() => void onDelete()}>Borrar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {entry.note ? (
          <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed">{entry.note}</p>
        ) : null}

        {entry.photos.length > 0 ? <PhotoMosaic photos={entry.photos} /> : null}
      </article>
    </li>
  );
}

/** Cuántas fotos se ven antes del «+N»: dos filas de tres. */
const MOSAIC_MAX = 6;

/**
 * Las fotos de una anotación.
 *
 * Una sola se ve grande, que es como se mandó; con más, una rejilla cuadrada.
 * Tocar cualquiera abre el visor, donde se pasa de una a otra.
 */
function PhotoMosaic({ photos }: { photos: readonly EntryPhotoView[] }) {
  const [shown, setShown] = useState<number | null>(null);
  const visible = photos.slice(0, MOSAIC_MAX);
  const hidden = photos.length - visible.length;

  return (
    <>
      <ul
        className={cn(
          'grid gap-2',
          photos.length === 1 ? 'grid-cols-1' : photos.length === 2 ? 'grid-cols-2' : 'grid-cols-3',
        )}
      >
        {visible.map((photo, index) => (
          <li key={photo.id}>
            <button
              type="button"
              onClick={() => setShown(index)}
              disabled={photo.url === null}
              className={cn(
                'bg-muted focus-visible:ring-ring relative block w-full overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2',
                photos.length === 1 ? 'aspect-[4/3] max-h-96' : 'aspect-square',
              )}
              aria-label={`Ver la foto ${index + 1} de ${photos.length}`}
            >
              {photo.url === null ? (
                <span className="text-muted-foreground grid size-full place-items-center px-2 text-center text-xs">
                  Esta foto ya no está
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo.thumbUrl ?? photo.url}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-300 hover:scale-[1.03] motion-reduce:transition-none"
                />
              )}

              {hidden > 0 && index === visible.length - 1 ? (
                <span className="bg-ciruela-900/60 text-papel-50 font-display absolute inset-0 grid place-items-center text-2xl font-bold">
                  +{hidden}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      <Dialog
        open={shown !== null}
        onOpenChange={(next) => {
          if (!next) setShown(null);
        }}
      >
        <DialogContent
          className="max-w-[min(56rem,calc(100%-2rem))] gap-3 p-3 sm:max-w-[min(56rem,calc(100%-2rem))]"
          onKeyDown={(event) => {
            if (shown === null || photos.length < 2) return;

            const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;

            if (step !== 0) setShown((shown + step + photos.length) % photos.length);
          }}
        >
          <DialogTitle className="sr-only">Foto de la anotación</DialogTitle>

          {shown !== null ? <PhotoViewer photos={photos} index={shown} onMove={setShown} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function PhotoViewer({
  photos,
  index,
  onMove,
}: {
  photos: readonly EntryPhotoView[];
  index: number;
  onMove: (index: number) => void;
}) {
  const photo = photos[index];
  const many = photos.length > 1;
  const move = (step: number) => onMove((index + step + photos.length) % photos.length);

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-ciruela-900 grid max-h-[75vh] place-items-center overflow-hidden rounded-lg">
        {photo?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt="" className="max-h-[75vh] w-auto object-contain" />
        ) : (
          <span className="text-papel-50/70 p-10 text-sm">Esta foto ya no está</span>
        )}
      </div>

      {many ? (
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => move(-1)}>
            <ChevronLeft /> Anterior
          </Button>
          <span className="text-muted-foreground text-sm tabular-nums">
            {index + 1} de {photos.length}
          </span>
          <Button variant="ghost" size="sm" onClick={() => move(1)}>
            Siguiente <ChevronRight />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Las anotaciones agrupadas por día de calendario local.
 *
 * La API ya las manda de la más reciente a la más vieja, así que basta con
 * cortar donde cambia el día.
 */
function byDay(entries: readonly HabitEntryView[]) {
  const days: { key: string; label: string; entries: HabitEntryView[] }[] = [];

  for (const entry of entries) {
    const date = new Date(entry.openedAt);
    const key = dayKey(date);
    const last = days.at(-1);

    if (last?.key === key) {
      last.entries.push(entry);
      continue;
    }

    days.push({ key, label: diaDe(entry.openedAt), entries: [entry] });
  }

  return days;
}

/** «hoy», «ayer», o «martes, 14 de septiembre» (con el año si no es este). */
function diaDe(iso: string): string {
  const days = daysAgo(iso);

  if (days <= 1) return new Intl.RelativeTimeFormat('es', { numeric: 'auto' }).format(-days, 'day');

  const date = new Date(iso);

  return date.toLocaleDateString('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}
