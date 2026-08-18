'use client';

import {
  COLUMN_ORDER,
  countLabel,
  LIBRARY_DESCRIPTION_MAX_LENGTH,
  LIBRARY_NAME_MAX_LENGTH,
  type LibrarySummary,
} from '@droply/contracts';
import { LibraryBig, Plus } from 'lucide-react';
import Link from 'next/link';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import { AppShell } from '@/components/app-shell';
import { LibraryActions } from '@/components/library-actions';
import { MorphDialogContent } from '@/components/morph-dialog-content';
import { RequireSession } from '@/components/require-session';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import { COLUMN_TINT } from '@/lib/columns';
import { useCreateLibrary, useLibraries } from '@/lib/libraries';
import { useMorphDialog } from '@/lib/morph-dialog';

export default function LibrariesPage() {
  return (
    <RequireSession>
      <AppShell crumbs={[{ label: 'Bibliotecas' }]}>
        <Content />
      </AppShell>
    </RequireSession>
  );
}

function Content() {
  const { data, isPending, error } = useLibraries();

  return (
    <div className="mx-auto w-full max-w-[100rem] px-6 py-8 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">Tus bibliotecas</h1>
          <p className="text-muted-foreground mt-2">
            Cada una es una colección. El bot toma de ahí lo que envía.
          </p>
        </div>

        <NewLibraryDialog id="nueva-biblioteca-cabecera" />
      </div>

      <div className="mt-10">
        {isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-36 w-full" />
            ))}
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTitle>No pudimos traer tus bibliotecas</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ) : data.length === 0 ? (
          <Empty className="border-border border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LibraryBig />
              </EmptyMedia>
              <EmptyTitle>Todavía no hay ninguna</EmptyTitle>
              <EmptyDescription>
                Crea la primera y empieza a llenarla con lo que quieres que llegue.
              </EmptyDescription>
            </EmptyHeader>
            <NewLibraryDialog id="nueva-biblioteca-vacio" />
          </Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((library) => (
              <LibraryCard key={library.id} library={library} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LibraryCard({ library }: { library: LibrarySummary }) {
  const filled = COLUMN_ORDER.filter((kind) => library.counts[kind] > 0);

  /*
   * El enlace es una capa que cubre la tarjeta, no un envoltorio.
   *
   * Envolviendo, el menú de opciones quedaría dentro del enlace: un botón
   * dentro de un `<a>` no es HTML válido y, en la práctica, tocar el menú
   * navegaría a la biblioteca. Así la tarjeta entera sigue siendo clicable y el
   * menú, que va por encima, se queda con sus propios clics.
   */
  return (
    <Card className="border-border hover:border-foreground/40 relative h-full border transition-colors">
      <CardHeader className="pr-12">
        <CardTitle className="text-2xl">{library.name}</CardTitle>
        <CardDescription className="line-clamp-2">
          {library.description ?? 'Sin descripción'}
        </CardDescription>
      </CardHeader>

      <div className="flex flex-wrap gap-2 px-6 pb-6">
        {filled.length === 0 ? (
          <span className="text-muted-foreground text-sm">Vacía</span>
        ) : (
          filled.map((kind) => (
            <Badge key={kind} variant="secondary" className={COLUMN_TINT[kind]}>
              {countLabel(kind, library.counts[kind])}
            </Badge>
          ))
        )}
      </div>

      <Link
        href={`/bibliotecas/${library.id}`}
        aria-label={`Abrir ${library.name}`}
        className="focus-visible:outline-ring absolute inset-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2"
      />

      <div className="absolute right-2 top-2 z-10">
        <LibraryActions library={library} />
      </div>
    </Card>
  );
}

function NewLibraryDialog({ id }: { id: string }) {
  const create = useCreateLibrary();
  const dialog = useMorphDialog(id);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const description = String(form.get('description')).trim();

    try {
      await create.mutateAsync({
        name: String(form.get('name')),
        ...(description ? { description } : {}),
      });

      dialog.close();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'No se pudo crear.');
    }
  }

  return (
    <Dialog open={dialog.open} onOpenChange={dialog.onOpenChange}>
      <DialogTrigger asChild>
        <Button {...dialog.fromProps}>
          {/* Blendy necesita que el contenido cuelgue de un solo elemento. */}
          <span className="flex items-center gap-2">
            <Plus /> Nueva biblioteca
          </span>
        </Button>
      </DialogTrigger>

      <MorphDialogContent toProps={dialog.toProps}>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Nueva biblioteca</DialogTitle>
            <DialogDescription>
              Escribe un nombre que te diga de un vistazo qué hay adentro.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-6">
            <Field>
              <FieldLabel htmlFor="name">Nombre</FieldLabel>
              <Input id="name" name="name" autoFocus required maxLength={LIBRARY_NAME_MAX_LENGTH} />
            </Field>

            <Field>
              <FieldLabel htmlFor="description">Descripción</FieldLabel>
              <Textarea
                id="description"
                name="description"
                rows={3}
                maxLength={LIBRARY_DESCRIPTION_MAX_LENGTH}
              />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={dialog.close}>
              Cancelar
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? <Spinner /> : null}
              Crear
            </Button>
          </DialogFooter>
        </form>
      </MorphDialogContent>
    </Dialog>
  );
}
