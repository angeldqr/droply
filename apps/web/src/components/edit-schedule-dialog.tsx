'use client';

import {
  COLUMN_LABELS,
  formatDayMinute,
  itemKind,
  SENDER_NAME_MAX_LENGTH,
  selectionStrategy,
  STRATEGY_LABELS,
  WEEKDAY_INITIALS,
  WEEKDAY_LABELS,
  WEEKDAYS,
  type ScheduleView,
} from '@droply/contracts';
import { Pencil } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { MorphDialogContent } from '@/components/morph-dialog-content';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { ApiError } from '@/lib/api';
import { useMorphDialog } from '@/lib/morph-dialog';
import { useUpdateSchedule } from '@/lib/schedules';

/** Las horas en punto: los minutos sueltos no aportan a un envío programado. */
export const HOURS = Array.from({ length: 24 }, (_, hour) => hour * 60);

export function hourOption(minute: number) {
  return (
    <SelectItem key={minute} value={String(minute)}>
      {formatDayMinute(minute)}
    </SelectItem>
  );
}

/**
 * Las siete casillas de los días, compartidas por crear y por editar.
 *
 * Siete casillas y no un desplegable: los días son pocos y fijos, y verlos
 * todos de un vistazo dice más que una lista que hay que abrir para saber qué
 * tiene marcado.
 */
export function WeekdayPicker({
  days,
  onToggle,
}: {
  days: readonly number[];
  onToggle: (day: number, checked: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {WEEKDAYS.map((day) => (
        <label
          key={day}
          className="border-border hover:bg-muted has-[[data-state=checked]]:border-primary flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 transition-colors"
          title={WEEKDAY_LABELS[day]}
        >
          <Checkbox
            checked={days.includes(day)}
            onCheckedChange={(checked) => onToggle(day, checked === true)}
          />
          <span className="text-sm">{WEEKDAY_INITIALS[day]}</span>
          <span className="sr-only">{WEEKDAY_LABELS[day]}</span>
        </label>
      ))}
    </div>
  );
}

/**
 * Cambiar cuándo sale un horario que ya existe.
 *
 * Se editan los días, la franja, el remitente y cómo elige: todo lo que uno
 * ajusta cuando el envío ya está andando y llega a mala hora. La biblioteca y
 * el destinatario **no**, y es a propósito — cambiarlos es otro envío, no el
 * mismo con otra ropa, y arrastraría a una biblioteca nueva la bolsa del "sin
 * repetir" que se llenó con la anterior.
 */
export function EditScheduleDialog({ schedule }: { schedule: ScheduleView }) {
  const update = useUpdateSchedule();
  const dialog = useMorphDialog(`editar-${schedule.id}`);

  const [days, setDays] = useState<number[]>([...schedule.weekdays]);
  const [startMinute, setStart] = useState(schedule.startMinute);
  const [endMinute, setEnd] = useState(schedule.endMinute);

  function toggleDay(day: number, checked: boolean) {
    setDays((current) =>
      checked ? [...current, day] : current.filter((chosen) => chosen !== day),
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const kindFilter = String(form.get('kindFilter'));
    const strategy = String(form.get('strategy'));

    try {
      await update.mutateAsync({
        scheduleId: schedule.id,
        weekdays: days as [1],
        startMinute,
        endMinute,
        senderName: String(form.get('senderName')),
        strategy: selectionStrategy.is(strategy) ? strategy : schedule.strategy,
        kindFilter: itemKind.is(kindFilter) ? kindFilter : null,
      });

      dialog.close();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'No se pudo guardar.');
    }
  }

  const field = (name: string) => `editar-${schedule.id}-${name}`;

  return (
    <Dialog open={dialog.open} onOpenChange={dialog.onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Editar este horario" {...dialog.fromProps}>
          {/* Blendy necesita que el contenido cuelgue de un solo elemento. */}
          <span className="flex items-center justify-center">
            <Pencil />
          </span>
        </Button>
      </DialogTrigger>

      <MorphDialogContent toProps={dialog.toProps} className="sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Editar horario</DialogTitle>
            <DialogDescription>
              {schedule.libraryName} → {schedule.recipientLabel}. Para cambiar la biblioteca o el
              destinatario, crea uno nuevo.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-6">
            <Field>
              <FieldLabel htmlFor={field('sender')}>Nombre de quien envía</FieldLabel>
              <Input
                id={field('sender')}
                name="senderName"
                maxLength={SENDER_NAME_MAX_LENGTH}
                defaultValue={schedule.senderName ?? ''}
              />
              <FieldDescription>Vacío para firmar como tu cuenta.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Qué días</FieldLabel>
              <WeekdayPicker days={days} onToggle={toggleDay} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor={field('start')}>Desde</FieldLabel>
                <Select
                  value={String(startMinute)}
                  onValueChange={(value) => setStart(Number(value))}
                >
                  <SelectTrigger id={field('start')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>{HOURS.map(hourOption)}</SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor={field('end')}>Hasta</FieldLabel>
                <Select value={String(endMinute)} onValueChange={(value) => setEnd(Number(value))}>
                  <SelectTrigger id={field('end')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>{HOURS.map(hourOption)}</SelectContent>
                </Select>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor={field('strategy')}>Cómo elige</FieldLabel>
              <Select name="strategy" defaultValue={schedule.strategy}>
                <SelectTrigger id={field('strategy')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectionStrategy.values.map((strategy) => (
                    <SelectItem key={strategy} value={strategy}>
                      {STRATEGY_LABELS[strategy]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor={field('kind')}>Qué manda</FieldLabel>
              <Select name="kindFilter" defaultValue={schedule.kindFilter ?? 'ALL'}>
                <SelectTrigger id={field('kind')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">De todas las columnas</SelectItem>
                  {itemKind.values.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      Solo {COLUMN_LABELS[kind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={dialog.close}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={update.isPending || days.length === 0 || endMinute <= startMinute}
            >
              {update.isPending ? <Spinner /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </MorphDialogContent>
    </Dialog>
  );
}
