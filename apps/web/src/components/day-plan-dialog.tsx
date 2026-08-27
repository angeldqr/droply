'use client';

import { COLUMN_LABELS, formatDayMinute, type ScheduleView } from '@reconectate/contracts';
import { CalendarClock, Pin } from 'lucide-react';
import { MorphDialogContent } from '@/components/morph-dialog-content';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { useMorphDialog } from '@/lib/morph-dialog';
import { useDayPlan } from '@/lib/schedules';

/**
 * Qué sale y a qué hora, el día entero.
 *
 * La tarjeta del horario decía solo cuándo era el próximo envío, así que para
 * saber a qué hora vuelve a salir un archivo había que rehacer a mano el
 * reparto. Con unas cuantas horas clavadas y varias veces al día por archivo,
 * esa cuenta no la hace nadie de cabeza.
 *
 * Es el plan de cualquier día en que el horario corra, no el de hoy: dentro de
 * un día activo el reparto siempre es el mismo.
 */
export function DayPlanDialog({ schedule }: { schedule: ScheduleView }) {
  const dialog = useMorphDialog(`day-${schedule.id}`);
  const day = useDayPlan(schedule.id, dialog.open);

  const rows = day.data ?? [];
  const clavados = rows.filter((row) => row.pinned).length;

  return (
    <Dialog open={dialog.open} onOpenChange={dialog.onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" {...dialog.fromProps}>
          {/* Blendy necesita que el contenido cuelgue de un solo elemento. */}
          <span className="flex items-center gap-2">
            <CalendarClock className="size-4" />
            Ver el día
          </span>
        </Button>
      </DialogTrigger>

      <MorphDialogContent toProps={dialog.toProps}>
        <div>
          <DialogHeader>
            <DialogTitle>El día completo</DialogTitle>
            <DialogDescription>
              Todo lo que sale y a qué hora, cada día que este horario corre.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-80 overflow-y-auto py-6">
            {day.isPending ? (
              <div className="flex flex-col gap-2">
                {[0, 1, 2].map((index) => (
                  <Skeleton key={index} className="h-8 w-full" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No sale nada</EmptyTitle>
                  <EmptyDescription>
                    {schedule.kindFilter === null
                      ? 'La biblioteca está vacía. Sube algo y vuelve.'
                      : `Este horario solo manda ${COLUMN_LABELS[schedule.kindFilter].toLowerCase()}, y esa columna está vacía.`}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul className="flex flex-col gap-1">
                {rows.map((row, index) => (
                  <li
                    key={`${row.minute}-${index}`}
                    className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm"
                  >
                    <span className="text-muted-foreground w-14 shrink-0 tabular-nums">
                      {formatDayMinute(row.minute)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{row.label}</span>
                    {row.pinned ? (
                      <Pin
                        className="text-muted-foreground size-3.5 shrink-0"
                        aria-label="Clavado a esta hora"
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/*
           * Cuántos envíos son, que es lo primero que uno quiere contar y lo
           * último que apetece hacer sumando líneas a ojo.
           */}
          {rows.length > 0 ? (
            <p className="text-muted-foreground border-t pt-4 text-sm">
              {rows.length} {rows.length === 1 ? 'envío' : 'envíos'} al día
              {clavados > 0 ? `, ${clavados} a una hora que fijaste` : ''}.
            </p>
          ) : null}
        </div>
      </MorphDialogContent>
    </Dialog>
  );
}
