'use client';

import { HABIT_NAME_MAX_LENGTH } from '@reconectate/contracts';
import { Plus } from 'lucide-react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import { MorphDialogContent } from '@/components/morph-dialog-content';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { ApiError } from '@/lib/api';
import { useCreateHabit } from '@/lib/journal';
import { useMorphDialog } from '@/lib/morph-dialog';

/** Un hábito es un nombre y nada más. Todo lo demás llega por el chat. */
export function NewHabitDialog({ id }: { id: string }) {
  const dialog = useMorphDialog(id);
  const create = useCreateHabit();

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    try {
      await create.mutateAsync({ name: String(form.get('name')) });
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
            <Plus /> Nuevo hábito
          </span>
        </Button>
      </DialogTrigger>

      <MorphDialogContent toProps={dialog.toProps}>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Nuevo hábito</DialogTitle>
            <DialogDescription>
              Lo que quieras llevar: ejercicio, alimentación, lectura. Después lo vas contando desde
              el chat.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-6">
            <Field>
              <FieldLabel htmlFor="name">Nombre</FieldLabel>
              <Input
                id="name"
                name="name"
                autoFocus
                required
                maxLength={HABIT_NAME_MAX_LENGTH}
                placeholder="Ejercicio"
              />
              <FieldDescription>Así lo vas a ver en la lista que te manda el bot.</FieldDescription>
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
