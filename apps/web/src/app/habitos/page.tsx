'use client';

import { HABIT_NAME_MAX_LENGTH, JOURNAL_COMMAND, type HabitView } from '@reconectate/contracts';
import { ArrowRight, MoreHorizontal, NotebookPen, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { AppShell } from '@/components/app-shell';
import { ConnectTelegramCard } from '@/components/connect-telegram-card';
import { HabitMark, whenRelative } from '@/components/habit-mark';
import { NewHabitDialog } from '@/components/new-habit-dialog';
import { RequireSession } from '@/components/require-session';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { ApiError } from '@/lib/api';
import { useDeleteHabit, useHabits, useRenameHabit } from '@/lib/journal';

export default function JournalPage() {
  return (
    <RequireSession>
      <AppShell crumbs={[{ label: 'Mi bitácora' }]}>
        <Contents />
      </AppShell>
    </RequireSession>
  );
}

function Contents() {
  const { data, isPending, error } = useHabits();

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Mi bitácora</h1>
          <p className="text-muted-foreground text-sm">
            Lo que vas haciendo, contado por ti desde el chat.
          </p>
        </div>

        {data && data.length > 0 ? <NewHabitDialog id="nuevo-habito" /> : null}
      </div>

      <ConnectTelegramCard habitNames={(data ?? []).map((habit) => habit.name)} />

      {data && data.length > 0 ? (
        <h2 className="font-display -mb-2 text-lg font-semibold">Tus hábitos</h2>
      ) : null}

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertTitle>No pudimos traer tus hábitos</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : data.length === 0 ? (
        <Empty className="border-border border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <NotebookPen />
            </EmptyMedia>
            <EmptyTitle>Todavía no hay ninguno</EmptyTitle>
            <EmptyDescription>
              Crea el primero —ejercicio, alimentación, lectura— y después escribe{' '}
              <code className="font-mono">{JOURNAL_COMMAND}</code> en el chat del bot para ir
              contando qué hiciste.
            </EmptyDescription>
          </EmptyHeader>
          <NewHabitDialog id="nuevo-habito-vacio" />
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((habit) => (
            <HabitCard key={habit.id} habit={habit} />
          ))}
        </div>
      )}
    </div>
  );
}

function HabitCard({ habit }: { habit: HabitView }) {
  return (
    <Card className="group relative gap-4 py-5 transition-all hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <CardHeader className="px-5">
        <div className="flex items-center gap-3">
          <HabitMark id={habit.id} name={habit.name} />

          <div className="min-w-0 flex-1">
            <CardTitle className="font-display truncate text-lg">{habit.name}</CardTitle>
            <p className="text-muted-foreground text-sm">
              {habit.entryCount === 0
                ? 'Sin anotaciones'
                : `${habit.entryCount} ${habit.entryCount === 1 ? 'anotación' : 'anotaciones'}`}
            </p>
          </div>

          {/* Por encima de la capa del enlace, o el menú no recibiría el clic. */}
          <div className="relative z-10 -mr-2 self-start">
            <HabitActions habit={habit} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex items-center justify-between gap-2 px-5">
        <span className="text-muted-foreground text-xs">
          {habit.lastEntryAt
            ? `Última anotación: ${whenRelative(habit.lastEntryAt)}`
            : `Escribe ${JOURNAL_COMMAND} y elige este hábito`}
        </span>
        <ArrowRight
          aria-hidden
          className="text-muted-foreground group-hover:text-primary size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
        />
      </CardContent>

      {/*
        La capa cubre la tarjeta entera en vez de envolverla: así el enlace no
        se lleva dentro nada que necesite su propio clic.
      */}
      <Link
        href={`/habitos/${encodeURIComponent(habit.id)}`}
        className="focus-visible:ring-ring absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-2"
        aria-label={`Abrir ${habit.name}`}
      >
        <span className="sr-only">Abrir {habit.name}</span>
      </Link>
    </Card>
  );
}

/**
 * Renombrar y borrar.
 *
 * Borrar se lleva la bitácora entera y sus fotos, así que lo dice antes de
 * hacerlo: es de las cosas que no se pueden deshacer.
 */
function HabitActions({ habit }: { habit: HabitView }) {
  const rename = useRenameHabit(habit.id);
  const remove = useDeleteHabit();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function onRename(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    try {
      await rename.mutateAsync({ name: String(form.get('name')) });
      setEditing(false);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'No se pudo renombrar.');
    }
  }

  async function onDelete(): Promise<void> {
    try {
      await remove.mutateAsync(habit.id);
      toast.success(`«${habit.name}» y su bitácora se borraron.`);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'No se pudo borrar.');
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Opciones de ${habit.name}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil /> Cambiar el nombre
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
            <Trash2 /> Borrar el hábito
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar «{habit.name}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Se va con todas sus anotaciones y sus fotos. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Dejarlo</AlertDialogCancel>
            <AlertDialogAction onClick={() => void onDelete()}>Borrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <form onSubmit={onRename}>
            <DialogHeader>
              <DialogTitle>Cambiar el nombre</DialogTitle>
              <DialogDescription>Así lo verás en la lista que te manda el bot.</DialogDescription>
            </DialogHeader>

            <FieldGroup className="py-6">
              <Field>
                <FieldLabel htmlFor={`nombre-${habit.id}`}>Nombre</FieldLabel>
                <Input
                  id={`nombre-${habit.id}`}
                  name="name"
                  autoFocus
                  required
                  maxLength={HABIT_NAME_MAX_LENGTH}
                  defaultValue={habit.name}
                />
              </Field>
            </FieldGroup>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={rename.isPending}>
                {rename.isPending ? <Spinner /> : null}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
