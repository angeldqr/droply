'use client';

import {
  COLUMN_LABELS,
  FIXED_ITEMS_MAX,
  formatDayMinute,
  type LibraryItemView,
  type ScheduleView,
} from '@reconectate/contracts';
import { Pin, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { ApiError } from '@/lib/api';
import { useLibrary } from '@/lib/libraries';
import { useMorphDialog } from '@/lib/morph-dialog';
import { useFixedItems, useSetFixedItems } from '@/lib/schedules';

/**
 * Cada media hora dentro de la franja.
 *
 * Media hora y no cada hora en punto porque las rejillas reales caen ahí: con
 * una franja de 6:00 a 21:00 y tres envíos, la del medio son las 13:30, y sin
 * media hora no se podría clavar nada en ella.
 */
function slotsWithin(startMinute: number, endMinute: number): number[] {
  const slots: number[] = [];

  for (let minute = startMinute; minute <= endMinute; minute += 30) slots.push(minute);

  return slots;
}

/** El nombre con el que se reconoce un archivo en la lista. */
function labelOf(item: LibraryItemView): string {
  return item.media?.fileName ?? item.text?.slice(0, 60) ?? 'Texto sin título';
}

/**
 * Qué le pasa a las veces al día del archivo que se está clavando.
 *
 * El número vive en la biblioteca, en otra pantalla, y sin él "es una de sus
 * veces al día" no dice nada: hay que acordarse de qué se puso. Con el número
 * delante se lee solo.
 */
function timesHint(timesPerDay: number, pinned: number): string {
  /*
   * El día sube las veces al número de horas clavadas si son más, así que
   * clavar de más no agrega envíos: los fija.
   */
  if (pinned >= timesPerDay) {
    return pinned === 1
      ? 'Única vez del día.'
      : `Sus ${pinned} salidas del día son las que fijaste.`;
  }

  const resto = timesPerDay - pinned;

  return `${pinned} de ${timesPerDay} al día; ${resto === 1 ? 'la otra la' : `las otras ${resto} las`} reparte el horario.`;
}

/**
 * Qué sale a qué hora, clavado.
 *
 * Hay cosas que no se dejan al reparto: "el buenos días de las 6" es siempre el
 * mismo audio, y a la hora que el reparto le toque no sería el de las 6. Una
 * hora clavada manda sobre el plan del día.
 *
 * Cuelga del horario y no de la biblioteca porque un envío fijo es archivo,
 * hora y persona a la vez: el mismo video puede ir a las 6 para tu papá y no
 * salir nunca para tu hermana.
 */
export function FixedItemsDialog({ schedule }: { schedule: ScheduleView }) {
  const dialog = useMorphDialog(`fijos-${schedule.id}`);
  const saved = useFixedItems(schedule.id);
  const library = useLibrary(schedule.libraryId);
  const save = useSetFixedItems(schedule.id);

  const [rows, setRows] = useState<{ minute: number; itemId: string }[]>([]);

  // Mientras el diálogo está cerrado manda el servidor; una vez abierto, manda
  // lo que el usuario va tocando.
  useEffect(() => {
    if (!dialog.open && saved.data) {
      setRows(saved.data.map((row) => ({ minute: row.minute, itemId: row.itemId })));
    }
  }, [dialog.open, saved.data]);

  const slots = slotsWithin(schedule.startMinute, schedule.endMinute);

  /* El horario que filtra por una columna solo puede clavar cosas de ella. */
  const items = (library.data?.items ?? []).filter(
    (item) => schedule.kindFilter === null || item.kind === schedule.kindFilter,
  );

  const taken = new Set(rows.map((row) => row.minute));
  const free = slots.filter((slot) => !taken.has(slot));

  /* Dos filas a la misma hora no se pueden guardar: una hora, una sola cosa. */
  const repeated = taken.size !== rows.length;
  const incomplete = rows.some((row) => row.itemId === '');

  function add() {
    const minute = free[0];
    const first = items[0];

    if (minute === undefined || !first) return;

    setRows((current) => [...current, { minute, itemId: first.id }]);
  }

  function update(index: number, changes: Partial<{ minute: number; itemId: string }>) {
    setRows((current) =>
      current.map((row, position) => (position === index ? { ...row, ...changes } : row)),
    );
  }

  function remove(index: number) {
    setRows((current) => current.filter((_, position) => position !== index));
  }

  async function onSave() {
    try {
      await save.mutateAsync({ fixedItems: rows });
      dialog.close();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'No se pudo guardar.');
    }
  }

  return (
    <Dialog open={dialog.open} onOpenChange={dialog.onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" {...dialog.fromProps}>
          {/* Blendy necesita que el contenido cuelgue de un solo elemento. */}
          <span className="flex items-center gap-2">
            <Pin className="size-4" />
            Envíos fijos
            {saved.data && saved.data.length > 0 ? (
              <span className="bg-secondary rounded-full px-1.5 text-xs tabular-nums">
                {saved.data.length}
              </span>
            ) : null}
          </span>
        </Button>
      </DialogTrigger>

      <MorphDialogContent toProps={dialog.toProps} className="sm:max-w-lg">
        <div>
          <DialogHeader>
            <DialogTitle>Envíos fijos</DialogTitle>
            <DialogDescription>
              A la hora que elijas sale ese archivo y no otro. Es una de sus veces al día, no un
              cambio.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-80 overflow-y-auto py-6">
            {saved.isPending || library.isPending ? (
              <div className="flex flex-col gap-2">
                {[0, 1].map((index) => (
                  <Skeleton key={index} className="h-10 w-full" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No hay nada que clavar</EmptyTitle>
                  <EmptyDescription>
                    {schedule.kindFilter === null
                      ? 'Esta biblioteca está vacía. Sube algo y vuelve.'
                      : `Este horario solo manda ${COLUMN_LABELS[schedule.kindFilter].toLowerCase()}, y esa columna está vacía.`}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="flex flex-col gap-3">
                {rows.map((row, index) => {
                  const elegido = items.find((candidate) => candidate.id === row.itemId);
                  /* El mismo archivo puede estar clavado a más de una hora. */
                  const clavadas = rows.filter((otra) => otra.itemId === row.itemId).length;

                  return (
                    <div key={`${row.minute}-${index}`} className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Select
                          value={String(row.minute)}
                          onValueChange={(value) => update(index, { minute: Number(value) })}
                        >
                          <SelectTrigger className="w-28 shrink-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {slots.map((slot) => (
                              <SelectItem
                                key={slot}
                                value={String(slot)}
                                // La hora que ya tiene dueño no se puede elegir
                                // dos veces: es la regla, y así se ve antes de
                                // guardar.
                                disabled={slot !== row.minute && taken.has(slot)}
                              >
                                {formatDayMinute(slot)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select
                          value={row.itemId}
                          onValueChange={(value) => update(index, { itemId: value })}
                        >
                          <SelectTrigger className="min-w-0 flex-1">
                            <SelectValue placeholder="Elige un archivo" />
                          </SelectTrigger>
                          <SelectContent>
                            {items.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                <span className="truncate">{labelOf(item)}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Quitar el envío de las ${formatDayMinute(row.minute)}`}
                          onClick={() => remove(index)}
                        >
                          <X />
                        </Button>
                      </div>

                      {/* Alineada con el archivo: los 112 px de la hora más la separación. */}
                      {elegido ? (
                        <p className="text-muted-foreground pl-30 text-xs">
                          {timesHint(elegido.timesPerDay, clavadas)}
                        </p>
                      ) : null}
                    </div>
                  );
                })}

                <Button
                  type="button"
                  variant="ghost"
                  className="self-start"
                  onClick={add}
                  disabled={free.length === 0 || rows.length >= FIXED_ITEMS_MAX}
                >
                  <Plus />
                  Clavar una hora
                </Button>

                {repeated ? (
                  <p className="text-destructive text-sm">Hay dos envíos a la misma hora.</p>
                ) : null}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={dialog.close}>
              Cancelar
            </Button>
            <Button
              onClick={() => void onSave()}
              disabled={save.isPending || repeated || incomplete}
            >
              {save.isPending ? <Spinner /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </div>
      </MorphDialogContent>
    </Dialog>
  );
}
