'use client';

import {
  JOURNAL_COMMAND,
  progressOf,
  RATE_WINDOW_DAYS,
  type EntryPhotoView,
  type HabitEntryView,
  type HabitProgress,
  type HabitView,
} from '@reconectate/contracts';
import { ChevronLeft, ChevronRight, NotebookPen, Pencil, Play, Trash2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AppShell } from '@/components/app-shell';
import { EditEntryDialog } from '@/components/edit-entry-dialog';
import { HabitCalendar } from '@/components/habit-calendar';
import { HabitTrend } from '@/components/habit-trend';
import { HabitYear } from '@/components/habit-year';
import {
  cuenta,
  dayKey,
  dayInWords,
  daysAgo,
  goalLabel,
  HabitMark,
  SHOW_ALL_DAYS,
} from '@/components/habit-mark';
import { Panel, PanelBar, PanelFigure, PanelHeader } from '@/components/panel';
import { RequireSession } from '@/components/require-session';
import { ShowMore } from '@/components/show-more';
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
import { useShown } from '@/lib/use-shown';
import { cn } from '@/lib/utils';

export default function HabitPage() {
  const params = useParams<{ habitId: string }>();

  return (
    <RequireSession>
      <Contents habitId={params.habitId} />
    </RequireSession>
  );
}

/** De a cuántos días se muestra el diario. */
const DAYS_PART = 10;

function Contents({ habitId }: { habitId: string }) {
  const habits = useHabits();
  const entries = useHabitEntries(habitId);
  const habit = habits.data?.find((row) => row.id === habitId);
  const name = habit?.name ?? 'Hábito';
  const list = entries.data ?? [];
  // El diario se dibuja de a diez días. El calendario, el año y la racha de
  // más abajo siguen contando `list` entera.
  const days = useShown(byDay(list), DAYS_PART);
  const showAllDays = days.all;

  // El calendario salta a un día que quizás todavía no está dibujado: avisa, y
  // acá se muestra el diario completo para que el salto encuentre su destino.
  useEffect(() => {
    window.addEventListener(SHOW_ALL_DAYS, showAllDays);

    return () => window.removeEventListener(SHOW_ALL_DAYS, showAllDays);
  }, [showAllDays]);
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
  // Con menos de tres semanas el año es media pantalla en blanco: solo el mes.
  const showYear = habit !== undefined && daysAgo(habit.createdAt) >= 21;

  return (
    <AppShell crumbs={[{ label: 'Mi bitácora', href: '/habitos' }, { label: name }]}>
      {/*
        Paneles a todo el ancho, como en Inicio: arriba cómo va hoy; debajo el
        calendario, que se queda fijo, junto al diario, que es lo que se lee
        bajando; y al final el historial largo, cuando ya hay historia.
      */}
      <div className="flex flex-col gap-2 pb-6 pt-2">
        {habits.error ? (
          <Alert variant="destructive">
            <AlertTitle>No pudimos traer este hábito</AlertTitle>
            <AlertDescription>{habits.error.message}</AlertDescription>
          </Alert>
        ) : habits.data && !habit ? (
          <Alert>
            <AlertTitle>Este hábito ya no existe</AlertTitle>
            <AlertDescription>
              Puede que lo hayas borrado. Vuelve a Mi bitácora para ver los que tienes.
            </AlertDescription>
          </Alert>
        ) : habit && goal && progress ? (
          <HabitHero
            habit={habit}
            progress={progress}
            paused={openPause?.from ?? null}
            counted={counted}
            photoCount={photoCount}
          />
        ) : (
          <Skeleton className="rounded-4xl h-44 w-full" />
        )}

        <div className="grid items-start gap-2 lg:grid-cols-3">
          <div className="lg:sticky lg:top-24">
            {/*
              Solo con las anotaciones ya leídas: antes, o si fallan, el
              calendario diría que no se cumplió ningún día, y no es cierto.
            */}
            {habit && goal && entries.data ? (
              <HabitCalendar
                days={perDay}
                firstDay={new Date(oldest?.openedAt ?? habit.createdAt)}
                goal={goal}
                pauses={habit.pauses}
              />
            ) : entries.error ? null : (
              <Skeleton className="rounded-4xl h-96 w-full" />
            )}
          </div>

          <Panel className="lg:col-span-2" aria-label="Tu diario">
            <PanelHeader
              title="Tu diario"
              description="Lo que le contaste al bot, de lo más nuevo a lo más viejo."
            />

            {entries.isPending ? (
              <div className="flex flex-col gap-3">
                {[0, 1].map((index) => (
                  <Skeleton key={index} className="h-32 w-full rounded-3xl" />
                ))}
              </div>
            ) : entries.error ? (
              <Alert variant="destructive">
                <AlertTitle>No pudimos abrir esta bitácora</AlertTitle>
                <AlertDescription>{entries.error.message}</AlertDescription>
              </Alert>
            ) : entries.data.length === 0 ? (
              <Empty className="py-12">
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
                {days.shown.map((day) => (
                  <section
                    key={day.key}
                    id={`dia-${day.key}`}
                    aria-label={day.label}
                    className="flex scroll-mt-28 flex-col gap-3"
                  >
                    {/* El día queda pegado arriba mientras se leen sus anotaciones. */}
                    <h2 className="bg-card/90 sticky top-20 z-10 -mx-2 flex items-center gap-3 px-2 py-1 backdrop-blur">
                      <span className="text-sm font-medium first-letter:uppercase">
                        {day.label}
                      </span>
                      <span className="bg-border h-px flex-1" aria-hidden />
                    </h2>

                    <ol className="border-border ml-1.5 flex flex-col gap-4 border-l-2 pl-5">
                      {day.entries.map((entry) => (
                        <EntryCard
                          key={entry.id}
                          entry={entry}
                          habitId={habitId}
                          habits={habits.data ?? []}
                        />
                      ))}
                    </ol>
                  </section>
                ))}
                <ShowMore
                  remaining={days.remaining}
                  size={DAYS_PART}
                  onMore={days.more}
                  className="self-start"
                />
              </div>
            )}
          </Panel>
        </div>

        {/* El largo plazo, cuando ya lo hay: con menos de tres semanas sería un panel en blanco. */}
        {showYear && habit && goal ? (
          <Panel>
            <PanelHeader title="Todo tu historial" />
            <div className="grid items-start gap-10 xl:grid-cols-[auto_minmax(0,1fr)] xl:gap-14">
              <HabitYear
                days={perDay}
                goal={goal}
                pauses={habit.pauses}
                since={dayKey(new Date(habit.createdAt))}
              />
              <HabitTrend
                days={perDay}
                goal={goal}
                pauses={habit.pauses}
                since={dayKey(new Date(habit.createdAt))}
              />
            </div>
          </Panel>
        ) : null}
      </div>
    </AppShell>
  );
}

/**
 * El panel negro de arriba: cómo va hoy, la racha y el último mes.
 *
 * Son las tres cifras que responden «¿lo estoy haciendo bien?». La de hoy va
 * grande y con su barra, porque es la única que todavía se puede cambiar. Si el
 * hábito está en pausa se dice acá mismo, con el botón para reanudarlo.
 */
function HabitHero({
  habit,
  progress,
  paused,
  counted,
  photoCount,
}: {
  habit: HabitView;
  progress: HabitProgress;
  /** Desde qué día está en pausa, o `null` si no lo está. */
  paused: string | null;
  counted: number;
  photoCount: number;
}) {
  const target = habit.dailyTarget;
  const today = progress.todayDone
    ? { value: '¡Cumplido!', hint: `${progress.todayCount} de ${target} veces hoy` }
    : progress.todayApplies
      ? { value: `${progress.todayCount} de ${target}`, hint: 'veces anotadas hoy' }
      : { value: paused ? 'En pausa' : 'Día libre', hint: 'hoy no cuenta' };

  return (
    <Panel filled className="gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <HabitMark id={habit.id} name={habit.name} className="size-12 text-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-primary-foreground/80">
            {goalLabel(habit.dailyTarget, habit.activeDays)}
          </p>
          <p className="text-primary-foreground/50 text-sm">
            {counted > 0
              ? `${cuenta(counted, 'anotación', 'anotaciones')} · ${cuenta(photoCount, 'foto', 'fotos')}`
              : 'Todavía sin anotaciones'}
          </p>
        </div>
        {paused ? <PausedNotice habitId={habit.id} since={paused} /> : null}
      </div>

      <dl className="grid gap-6 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <PanelFigure label="Hoy" value={today.value} hint={today.hint} big>
          {progress.todayApplies ? (
            <PanelBar
              value={(progress.todayCount / target) * 100}
              label={`${progress.todayCount} de ${target} veces hoy`}
            />
          ) : null}
        </PanelFigure>
        <PanelFigure
          label="Racha"
          value={cuenta(progress.streak, 'día', 'días')}
          hint={
            progress.bestStreak > 0
              ? `La mejor: ${cuenta(progress.bestStreak, 'día', 'días')}`
              : 'Cumple hoy para empezarla'
          }
        />
        <PanelFigure
          label={`Últimos ${RATE_WINDOW_DAYS} días`}
          value={progress.rate === null ? '—' : `${Math.round(progress.rate * 100)}%`}
          hint={progress.rate === null ? 'Todavía no hay días para medir' : 'de la meta cumplida'}
        />
      </dl>
    </Panel>
  );
}

/** El hábito está en pausa: se dice en el panel negro y se puede reanudar ahí mismo. */
function PausedNotice({ habitId, since }: { habitId: string; since: string }) {
  const resume = useResumeHabit(habitId);
  const date = dayInWords(since);

  async function onResume(): Promise<void> {
    try {
      await resume.mutateAsync();
      toast.success('Vuelve a contar desde hoy.');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'No se pudo reanudar.');
    }
  }

  return (
    <div className="bg-primary-foreground/10 flex flex-wrap items-center gap-3 rounded-3xl py-2 pl-4 pr-2">
      <p className="text-sm">
        <span className="font-medium">En pausa desde el {date}.</span>{' '}
        <span className="text-primary-foreground/60">No cuenta como fallo ni corta tu racha.</span>
      </p>
      <Button
        size="sm"
        className="bg-menta hover:bg-menta/85 text-sobre-menta"
        onClick={() => void onResume()}
        disabled={resume.isPending}
      >
        {resume.isPending ? <Spinner /> : <Play />}
        Reanudar
      </Button>
    </div>
  );
}

/** Una anotación. */
function EntryCard({
  entry,
  habitId,
  habits,
}: {
  entry: HabitEntryView;
  habitId: string;
  habits: readonly HabitView[];
}) {
  const remove = useDeleteEntry(habitId);
  const [editing, setEditing] = useState(false);
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
          'ring-card absolute -left-[27px] top-5 size-3 rounded-full ring-4',
          open ? 'bg-logro motion-safe:animate-pulse' : 'bg-menta',
        )}
      />

      <article className="bg-muted/60 flex flex-col gap-3 rounded-3xl p-4 md:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <time className="font-semibold tabular-nums" dateTime={entry.openedAt}>
              {hora(entry.openedAt)}
            </time>

            {/* Abierta quiere decir que todavía le puede caer algo desde el chat. */}
            {open ? <span className="text-logro text-xs font-semibold">· En curso</span> : null}
          </div>

          <div className="-mr-2 flex items-center opacity-100 transition-opacity md:opacity-0 md:focus-within:opacity-100 md:group-hover:opacity-100">
            {/* Corregir solo lo que ya cerró: lo abierto sigue creciendo en el chat. */}
            {open ? null : (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setEditing(true)}
                aria-label="Corregir esta anotación"
              >
                <Pencil />
              </Button>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
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
        </div>

        {/* Montado solo al abrirlo: así vuelve a partir de lo que hay guardado. */}
        {editing ? (
          <EditEntryDialog
            entry={entry}
            habitId={habitId}
            habits={habits}
            open
            onOpenChange={setEditing}
          />
        ) : null}

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
  // La foto bajo el cursor queda nítida y las demás se apagan un poco.
  const [hovered, setHovered] = useState<number | null>(null);
  const visible = photos.slice(0, MOSAIC_MAX);
  const hidden = photos.length - visible.length;

  return (
    <>
      <ul
        className={cn(
          'grid max-w-xl gap-2',
          photos.length === 1 ? 'grid-cols-1' : photos.length === 2 ? 'grid-cols-2' : 'grid-cols-3',
        )}
      >
        {visible.map((photo, index) => (
          <li
            key={photo.id}
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered(null)}
            className={cn(
              'transition-[filter,transform] duration-300 ease-out motion-reduce:transition-none',
              hovered !== null && hovered !== index && 'scale-[0.98] blur-[2px]',
            )}
          >
            <button
              type="button"
              onClick={() => setShown(index)}
              disabled={photo.url === null}
              className={cn(
                'bg-muted focus-visible:ring-ring relative block w-full overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2',
                photos.length === 1 ? 'aspect-[4/3] max-h-72' : 'aspect-square',
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
                <span className="font-display bg-noche/60 text-noche-tinta absolute inset-0 grid place-items-center text-2xl font-bold">
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
      <div className="bg-noche grid max-h-[75vh] place-items-center overflow-hidden rounded-lg">
        {photo?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt="" className="max-h-[75vh] w-auto object-contain" />
        ) : (
          <span className="text-noche-tinta/70 p-10 text-sm">Esta foto ya no está</span>
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
