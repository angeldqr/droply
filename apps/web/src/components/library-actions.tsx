'use client';

import {
  LIBRARY_DESCRIPTION_MAX_LENGTH,
  LIBRARY_NAME_MAX_LENGTH,
  type LibrarySummary,
} from '@droply/contracts';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { MorphDialogContent } from '@/components/morph-dialog-content';
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
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import { useDeleteLibrary, useRenameLibrary } from '@/lib/libraries';
import { useMorphDialog } from '@/lib/morph-dialog';

/**
 * Cambiar el nombre y borrar, tanto en el listado como dentro de la biblioteca.
 *
 * El formulario de renombrar nace del propio botón de opciones, igual que el de
 * crear nace del suyo: un diálogo que aparece en el centro no dice de dónde
 * salió, y en un listado de tarjetas no se sabría cuál se está tocando.
 *
 * El de borrar sí queda en el centro, y a propósito: una confirmación
 * destructiva quiere cortar el gesto, no continuarlo.
 */
export function LibraryActions({
  library,
  onDeleted,
}: {
  library: LibrarySummary;
  /** El listado se queda donde está; la pantalla de la biblioteca tiene que irse. */
  onDeleted?: () => void;
}) {
  const rename = useRenameLibrary(library.id);
  const remove = useDeleteLibrary();
  const dialog = useMorphDialog(`renombrar-${library.id}`);
  const [confirming, setConfirming] = useState(false);

  async function onRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const description = String(form.get('description')).trim();

    try {
      await rename.mutateAsync({
        name: String(form.get('name')),
        ...(description ? { description } : {}),
      });

      dialog.close();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'No se pudo guardar.');
    }
  }

  async function onDelete() {
    try {
      await remove.mutateAsync(library.id);

      toast.success(`Se borró «${library.name}».`);
      onDeleted?.();
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
            size="icon"
            aria-label={`Opciones de ${library.name}`}
            {...dialog.fromProps}
          >
            {/* Blendy necesita que el contenido cuelgue de un solo elemento. */}
            <span className="flex items-center justify-center">
              <MoreHorizontal />
            </span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={dialog.openDialog}>
            <Pencil /> Cambiar nombre
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
            <Trash2 /> Borrar biblioteca
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog.open} onOpenChange={dialog.onOpenChange}>
        <MorphDialogContent toProps={dialog.toProps}>
          <form onSubmit={onRename}>
            <DialogHeader>
              <DialogTitle>Cambiar nombre</DialogTitle>
              <DialogDescription>
                Escribe un nombre que te diga de un vistazo qué hay adentro.
              </DialogDescription>
            </DialogHeader>

            <FieldGroup className="py-6">
              <Field>
                <FieldLabel htmlFor="name">Nombre</FieldLabel>
                <Input
                  id="name"
                  name="name"
                  defaultValue={library.name}
                  autoFocus
                  required
                  maxLength={LIBRARY_NAME_MAX_LENGTH}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="description">Descripción</FieldLabel>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={library.description ?? ''}
                  rows={3}
                  maxLength={LIBRARY_DESCRIPTION_MAX_LENGTH}
                />
              </Field>
            </FieldGroup>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={dialog.close}>
                Cancelar
              </Button>
              <Button type="submit" disabled={rename.isPending}>
                {rename.isPending ? <Spinner /> : null}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </MorphDialogContent>
      </Dialog>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar «{library.name}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Se van también todos sus elementos y los archivos que subiste. No hay forma de
              recuperarlos.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              disabled={remove.isPending}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              {remove.isPending ? <Spinner /> : null}
              Borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
