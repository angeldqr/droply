'use client';

import {
  HABIT_PLAN_DURATIONS,
  HABIT_PLAN_LIBRARIES_MAX,
  HABIT_PLAN_NAME_MAX_LENGTH,
  type HabitPlanSummary,
} from '@reconectate/contracts';
import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { MorphDialogContent } from '@/components/morph-dialog-content';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { ApiError } from '@/lib/api';
import { librariesInUse, useCreateHabitPlan } from '@/lib/habits';
import { useLibraries } from '@/lib/libraries';
import { useMorphDialog } from '@/lib/morph-dialog';
import { useRecipients } from '@/lib/recipients';
import { browserTimezone } from '@/lib/schedules';

/**
 * Armar un plan: a quién, con qué bibliotecas y por cuánto tiempo.
 *
 * Las tres cosas se eligen una sola vez. La advertencia de abajo no es un
 * adorno legal: después de crear el plan no hay ninguna forma de cambiarlas —la
 * API ni siquiera tiene la ruta— y enterarse en ese momento es lo que llena el
 * soporte.
 */
export function NewHabitPlanDialog({
  id,
  plans,
}: {
  id: string;
  plans: readonly HabitPlanSummary[];
}) {
  const dialog = useMorphDialog(id);
  const create = useCreateHabitPlan();
  const libraries = useLibraries();
  const recipients = useRecipients();

  const [chosen, setChosen] = useState<string[]>([]);
  const [recipientId, setRecipientId] = useState('');
  const [durationDays, setDurationDays] = useState('30');

  // Un bot no puede escribirle a alguien que nunca le habló, así que un
  // destinatario pendiente no puede recibir ni los botones ni el informe.
  const linked = (recipients.data ?? []).filter((recipient) => recipient.status === 'VERIFIED');
  const taken = librariesInUse(plans);
  const full = chosen.length >= HABIT_PLAN_LIBRARIES_MAX;

  function toggle(libraryId: string, checked: boolean): void {
    setChosen((current) =>
      checked ? [...current, libraryId] : current.filter((id) => id !== libraryId),
    );
  }

  function reset(open: boolean): void {
    dialog.onOpenChange(open);

    if (!open) {
      setChosen([]);
      setRecipientId('');
      setDurationDays('30');
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    try {
      await create.mutateAsync({
        name: String(form.get('name')),
        recipientId,
        durationDays: Number(durationDays) as (typeof HABIT_PLAN_DURATIONS)[number],
        libraryIds: chosen,
        // La zona del navegador, que es la que el usuario tiene en la cabeza
        // cuando dice «el resumen de hoy». Igual que al crear un horario.
        timezone: browserTimezone(),
      });

      reset(false);
      dialog.close();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'No se pudo crear el plan.');
    }
  }

  const ready = recipientId !== '' && chosen.length > 0;

  return (
    <Dialog open={dialog.open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button {...dialog.fromProps}>
          {/* Blendy necesita que el contenido cuelgue de un solo elemento. */}
          <span className="flex items-center gap-2">
            <Plus /> Nuevo plan
          </span>
        </Button>
      </DialogTrigger>

      <MorphDialogContent toProps={dialog.toProps}>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Nuevo plan de hábitos</DialogTitle>
            <DialogDescription>
              Cada biblioteca que elijas será un hábito. Lo que salga de ellas llegará con tres
              botones para responder si se cumplió.
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
                maxLength={HABIT_PLAN_NAME_MAX_LENGTH}
                placeholder="Yo en 30 días"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="recipient">Para quién</FieldLabel>
              <Select value={recipientId} onValueChange={setRecipientId}>
                <SelectTrigger id="recipient">
                  <SelectValue placeholder="Elige a quién le llegan" />
                </SelectTrigger>
                <SelectContent>
                  {linked.map((recipient) => (
                    <SelectItem key={recipient.id} value={recipient.id}>
                      {recipient.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                Solo aparecen los destinatarios que ya abrieron su enlace: el informe y los botones
                van a su chat.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="duration">Duración</FieldLabel>
              <Select value={durationDays} onValueChange={setDurationDays}>
                <SelectTrigger id="duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HABIT_PLAN_DURATIONS.map((days) => (
                    <SelectItem key={days} value={String(days)}>
                      {days} días
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Hábitos</FieldLabel>

              <ScrollArea className="border-border max-h-56 rounded-lg border">
                <div className="flex flex-col gap-1 p-2">
                  {(libraries.data ?? []).map((library) => {
                    const busy = taken.get(library.id);
                    const checked = chosen.includes(library.id);

                    return (
                      <Label
                        key={library.id}
                        htmlFor={`habito-${library.id}`}
                        className="hover:bg-accent/50 has-disabled:opacity-60 flex items-start gap-3 rounded-md p-2 font-normal"
                      >
                        <Checkbox
                          id={`habito-${library.id}`}
                          checked={checked}
                          disabled={busy !== undefined || (full && !checked)}
                          onCheckedChange={(value) => toggle(library.id, value === true)}
                        />
                        <span className="grid min-w-0 gap-0.5">
                          <span className="truncate text-sm">{library.name}</span>
                          {busy ? (
                            <span className="text-muted-foreground text-xs">
                              Ya es un hábito de «{busy}»
                            </span>
                          ) : null}
                        </span>
                      </Label>
                    );
                  })}
                </div>
              </ScrollArea>

              <FieldDescription>
                Hasta {HABIT_PLAN_LIBRARIES_MAX}. Una biblioteca solo puede estar en un plan a la
                vez; anular el otro la libera.
              </FieldDescription>
            </Field>

            <Alert>
              <AlertTitle>Esto no se puede cambiar después</AlertTitle>
              <AlertDescription>
                Ni las bibliotecas ni la duración. Si te equivocas, anula el plan y crea otro.
              </AlertDescription>
            </Alert>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={dialog.close}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!ready || create.isPending}>
              {create.isPending ? <Spinner /> : null}
              Crear plan
            </Button>
          </DialogFooter>
        </form>
      </MorphDialogContent>
    </Dialog>
  );
}
