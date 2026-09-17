'use client';

import { ENTRY_NOTE_MAX_LENGTH, type HabitEntryView, type HabitView } from '@reconectate/contracts';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { dayKey } from '@/components/habit-mark';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import { useEditEntry } from '@/lib/journal';

/**
 * Corregir lo que el bot guardó: el texto, el hábito o el día.
 *
 * El día es lo que arregla la anotación de las 23:58, que quedó contada en el
 * día anterior. Las fotos no se tocan acá: para cambiarlas se borra y se vuelve
 * a mandar, que es más corto que explicarlo.
 */
export function EditEntryDialog({
  entry,
  habitId,
  habits,
  open,
  onOpenChange,
}: {
  entry: HabitEntryView;
  habitId: string;
  habits: readonly HabitView[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const edit = useEditEntry();
  const [target, setTarget] = useState(habitId);
  const today = dayKey(new Date());

  // Los pausados no se ofrecen, igual que en el bot; el actual sí, aunque lo esté.
  const choices = habits.filter((habit) => !habit.paused || habit.id === habitId);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    try {
      await edit.mutateAsync({
        id: entry.id,
        changes: {
          note: String(form.get('note')),
          habitId: target,
          day: String(form.get('day')),
        },
      });
      onOpenChange(false);
      toast.success('Anotación corregida.');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'No se pudo corregir.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Corregir la anotación</DialogTitle>
            <DialogDescription>
              Lo que el bot guardó mal: el texto, el hábito al que fue o el día en que cuenta.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-6">
            <Field>
              <FieldLabel htmlFor={`texto-${entry.id}`}>Texto</FieldLabel>
              <Textarea
                id={`texto-${entry.id}`}
                name="note"
                rows={4}
                maxLength={ENTRY_NOTE_MAX_LENGTH}
                defaultValue={entry.note ?? ''}
                placeholder="Sin texto"
              />
              <FieldDescription>
                Reemplaza lo que hay. Vacío la deja solo con fotos.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor={`habito-${entry.id}`}>Hábito</FieldLabel>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger id={`habito-${entry.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {choices.map((habit) => (
                    <SelectItem key={habit.id} value={habit.id}>
                      {habit.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor={`dia-${entry.id}`}>Día</FieldLabel>
              <Input
                id={`dia-${entry.id}`}
                name="day"
                type="date"
                required
                max={today}
                defaultValue={dayKey(new Date(entry.openedAt))}
              />
              <FieldDescription>La hora se conserva: solo cambia el día.</FieldDescription>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={edit.isPending}>
              {edit.isPending ? <Spinner /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
