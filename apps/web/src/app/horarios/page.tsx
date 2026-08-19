'use client';

import {
  COLUMN_LABELS,
  DELIVERY_STATUS_LABELS,
  describeWeekdays,
  formatDayMinute,
  itemKind,
  SENDER_NAME_MAX_LENGTH,
  WEEKDAYS,
  type ScheduleView,
} from '@droply/contracts';
import { CalendarClock, Pin, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { AppShell } from '@/components/app-shell';
import { FixedItemsDialog } from '@/components/fixed-items-dialog';
import { Notices } from '@/components/notices';
import {
  EditScheduleDialog,
  hourOption,
  HOURS,
  WeekdayPicker,
} from '@/components/edit-schedule-dialog';
import { MorphDialogContent } from '@/components/morph-dialog-content';
import { RequireSession } from '@/components/require-session';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { ApiError } from '@/lib/api';
import { useLibraries, useLibraryRecipients } from '@/lib/libraries';
import { useMorphDialog } from '@/lib/morph-dialog';
import { useRecipients } from '@/lib/recipients';
import { useSession } from '@/lib/session';
import {
  browserTimezone,
  useCreateSchedule,
  useDeleteSchedule,
  useFixedItems,
  useDeliveries,
  useSchedules,
  useUpdateSchedule,
} from '@/lib/schedules';

export default function SchedulesPage() {
  return (
    <RequireSession>
      <AppShell crumbs={[{ label: 'Horarios' }]}>
        <Contents />
      </AppShell>
    </RequireSession>
  );
}

function Contents() {
  const { data, isPending, error } = useSchedules();

  return (
    <div className="mx-auto w-full max-w-[100rem] px-6 py-8 md:px-10">
      {/*
        Los avisos van antes que nada: quien entra acá porque no le llegó algo
        tiene que encontrar el porqué sin buscarlo.
      */}
      <Notices />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-4xl">Horarios</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Cuándo sale cada envío y hacia quién. El bot toma un elemento de la biblioteca y lo
            manda solo, a la hora que digas y en tu zona horaria.
          </p>
        </div>

        <NewScheduleDialog id="nuevo-horario-cabecera" />
      </div>

      <div className="mt-10">
        {isPending ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-20 w-full" />
            ))}
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTitle>No pudimos traer tus horarios</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ) : data.length === 0 ? (
          <Empty className="border-border border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarClock />
              </EmptyMedia>
              <EmptyTitle>Todavía no hay ninguno</EmptyTitle>
              <EmptyDescription>
                Programa el primero y deja de acordarte de mandar las cosas a mano.
              </EmptyDescription>
            </EmptyHeader>
            <NewScheduleDialog id="nuevo-horario-vacio" />
          </Empty>
        ) : (
          <ul className="flex max-w-4xl flex-col gap-2">
            {data.map((schedule) => (
              <li key={schedule.id}>
                <ScheduleRow schedule={schedule} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <DeliveryHistory />
    </div>
  );
}

/**
 * Lo último que salió.
 *
 * Sin esto nadie confía en un programador de envíos: si no se ve que salieron,
 * la única forma de saberlo es preguntarle a quien los recibe. Y cuando algo
 * falla —el bot bloqueado, un archivo que ya no está— acá es donde se entera el
 * dueño, en vez de descubrirlo semanas después.
 */
function DeliveryHistory() {
  const deliveries = useDeliveries();

  if (deliveries.isPending || (deliveries.data?.length ?? 0) === 0) return null;

  return (
    <section className="mt-12 max-w-4xl">
      <h2 className="text-2xl">Últimos envíos</h2>

      <ul className="mt-4 flex flex-col gap-1">
        {deliveries.data?.map((delivery) => (
          <li
            key={delivery.id}
            className="border-border flex flex-wrap items-center gap-3 border-b py-2 text-sm last:border-b-0"
          >
            <Badge variant={delivery.status === 'SENT' ? 'secondary' : 'outline'}>
              {DELIVERY_STATUS_LABELS[delivery.status]}
            </Badge>
            <span className="min-w-0 flex-1 truncate">
              {delivery.libraryName} → {delivery.recipientLabel}
            </span>
            {delivery.error ? (
              <span className="text-muted-foreground truncate">{delivery.error}</span>
            ) : null}
            <span className="text-muted-foreground tabular-nums">
              {WHEN.format(new Date(delivery.occurredAt))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/*
 * La fecha se arma en el navegador y nunca en el servidor: estas filas solo se
 * pintan con sesión resuelta y con la respuesta ya en mano.
 */
const WHEN = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' });

function ScheduleRow({ schedule }: { schedule: ScheduleView }) {
  const update = useUpdateSchedule();
  const remove = useDeleteSchedule();
  const [confirming, setConfirming] = useState(false);

  function toggle(active: boolean) {
    update.mutate(
      { scheduleId: schedule.id, active },
      {
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.message : 'No se pudo cambiar.'),
      },
    );
  }

  return (
    <>
      <Item variant="outline" size="sm" className="bg-card items-start">
        <ItemContent className="min-w-0">
          <ItemTitle className="truncate">
            {schedule.libraryName} → {schedule.recipientLabel}
          </ItemTitle>
          <ItemDescription>{describe(schedule)}</ItemDescription>
          <FixedSummary scheduleId={schedule.id} />
        </ItemContent>

        <ItemActions className="items-center">
          {schedule.kindFilter ? (
            <Badge variant="secondary">Solo {COLUMN_LABELS[schedule.kindFilter]}</Badge>
          ) : null}

          {/*
            Pausar es lo que se hace de verdad cuando un envío molesta una
            temporada; borrar es para cuando ya no lo quieres nunca más. Por eso
            el interruptor está a mano y el borrado pide confirmación.
          */}
          <Switch
            checked={schedule.active}
            onCheckedChange={toggle}
            disabled={update.isPending}
            aria-label={schedule.active ? 'Pausar este horario' : 'Reanudar este horario'}
          />

          <FixedItemsDialog schedule={schedule} />

          <EditScheduleDialog schedule={schedule} />

          <Button
            variant="ghost"
            size="icon"
            aria-label="Borrar este horario"
            onClick={() => setConfirming(true)}
          >
            <Trash2 />
          </Button>
        </ItemActions>
      </Item>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar este horario?</AlertDialogTitle>
            <AlertDialogDescription>
              Deja de enviarse a {schedule.recipientLabel}. Si solo quieres cortarlo un tiempo,
              úsalo pausado en vez de borrarlo.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                remove.mutate(schedule.id, {
                  onError: (error) =>
                    toast.error(error instanceof ApiError ? error.message : 'No se pudo borrar.'),
                })
              }
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

/**
 * Las horas clavadas, debajo de la fila.
 *
 * Se ven sin abrir nada porque son la excepción al reparto: el resto de la
 * franja la ordena el plan del día, y estas horas las eligió el dueño a mano.
 * Sin verlas no hay forma de saber que están puestas.
 */
function FixedSummary({ scheduleId }: { scheduleId: string }) {
  const fixed = useFixedItems(scheduleId);

  if (!fixed.data || fixed.data.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {fixed.data.map((item) => (
        <Badge key={item.minute} variant="outline" className="font-normal">
          <Pin className="size-3" />
          {formatDayMinute(item.minute)} · <span className="truncate">{item.label}</span>
        </Badge>
      ))}
    </div>
  );
}

/** Qué dice la fila: lo que importa es cuándo sale el próximo, no la regla. */
function describe(schedule: ScheduleView): string {
  const repeat = `${describeWeekdays(schedule.weekdays)}, de ${formatDayMinute(
    schedule.startMinute,
  )} a ${formatDayMinute(schedule.endMinute)}`;
  // El remitente solo se nombra cuando es distinto del nombre de la cuenta:
  // repetirlo en todas las filas sería ruido.
  const from = schedule.senderName ? ` Firmado como ${schedule.senderName}.` : '';

  if (!schedule.active) return `${repeat}. Pausado.${from}`;
  if (!schedule.nextRunAt) return `${repeat}. Ya no vuelve a repetirse.${from}`;

  return `${repeat}. El próximo el ${WHEN.format(new Date(schedule.nextRunAt))}.${from}`;
}

function NewScheduleDialog({ id }: { id: string }) {
  const create = useCreateSchedule();
  const dialog = useMorphDialog(id);
  const libraries = useLibraries();
  const recipients = useRecipients();
  const { user } = useSession();

  /*
   * La biblioteca elegida es estado y no solo un campo del formulario, porque
   * de ella depende a quién se puede enviar: cada biblioteca tiene su propia
   * lista de destinatarios y el desplegable de al lado se filtra con ella.
   */
  const [libraryId, setLibraryId] = useState('');
  const [days, setDays] = useState<number[]>([...WEEKDAYS]);
  const [startMinute, setStart] = useState(9 * 60);
  const [endMinute, setEnd] = useState(21 * 60);

  function toggleDay(day: number, checked: boolean) {
    setDays((current) =>
      checked ? [...current, day] : current.filter((chosen) => chosen !== day),
    );
  }
  const chosenLibrary = libraryId || (libraries.data?.[0]?.id ?? '');
  const allowed = useLibraryRecipients(chosenLibrary);

  const linked = recipients.data?.filter((recipient) => recipient.status === 'VERIFIED') ?? [];
  const reachable = linked.filter((recipient) => allowed.data?.includes(recipient.id));

  /* Sin biblioteca, o con una que no le manda a nadie, no hay horario posible. */
  const ready = chosenLibrary !== '' && reachable.length > 0;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const kindFilter = String(form.get('kindFilter'));

    try {
      await create.mutateAsync({
        libraryId: String(form.get('libraryId')),
        recipientId: String(form.get('recipientId')),
        senderName: String(form.get('senderName')),
        weekdays: days as [1],
        startMinute,
        endMinute,
        timezone: browserTimezone(),
        kindFilter: itemKind.is(kindFilter) ? kindFilter : null,
      });

      dialog.close();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'No se pudo programar.');
    }
  }

  return (
    <Dialog open={dialog.open} onOpenChange={dialog.onOpenChange}>
      <DialogTrigger asChild>
        <Button {...dialog.fromProps}>
          {/* Blendy necesita que el contenido cuelgue de un solo elemento. */}
          <span className="flex items-center gap-2">
            <Plus /> Nuevo horario
          </span>
        </Button>
      </DialogTrigger>

      <MorphDialogContent toProps={dialog.toProps} className="sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Nuevo horario</DialogTitle>
            <DialogDescription>
              Qué biblioteca, a quién y cada cuánto. La hora va en tu zona: {browserTimezone()}.
            </DialogDescription>
          </DialogHeader>

          {ready ? (
            <FieldGroup className="py-6">
              <Field>
                <FieldLabel htmlFor={`${id}-library`}>Biblioteca</FieldLabel>
                <Select name="libraryId" value={chosenLibrary} onValueChange={setLibraryId}>
                  <SelectTrigger id={`${id}-library`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {libraries.data?.map((library) => (
                      <SelectItem key={library.id} value={library.id}>
                        {library.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor={`${id}-recipient`}>Destinatario</FieldLabel>
                <Select name="recipientId" defaultValue={reachable[0]?.id} key={chosenLibrary}>
                  <SelectTrigger id={`${id}-recipient`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {reachable.map((recipient) => (
                      <SelectItem key={recipient.id} value={recipient.id}>
                        {recipient.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Solo los que esta biblioteca tiene marcados. Se eligen desde la biblioteca.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor={`${id}-sender`}>Nombre de quien envía</FieldLabel>
                <Input
                  id={`${id}-sender`}
                  name="senderName"
                  maxLength={SENDER_NAME_MAX_LENGTH}
                  placeholder={user?.displayName ?? 'Tu nombre'}
                />
                <FieldDescription>
                  Con este nombre le llega el envío. Déjalo vacío para firmar como tu cuenta.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel>Qué días</FieldLabel>
                {/*
                  Siete casillas y no un desplegable: los días son pocos y fijos,
                  y verlos todos de un vistazo dice más que una lista que hay que
                  abrir para saber qué tiene marcado.
                */}
                <WeekdayPicker days={days} onToggle={toggleDay} />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor={`${id}-start`}>Desde</FieldLabel>
                  <Select
                    value={String(startMinute)}
                    onValueChange={(value) => setStart(Number(value))}
                  >
                    <SelectTrigger id={`${id}-start`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>{HOURS.map(hourOption)}</SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor={`${id}-end`}>Hasta</FieldLabel>
                  <Select
                    value={String(endMinute)}
                    onValueChange={(value) => setEnd(Number(value))}
                  >
                    <SelectTrigger id={`${id}-end`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>{HOURS.map(hourOption)}</SelectContent>
                  </Select>
                </Field>
              </div>

              <FieldDescription>
                Dentro de esa franja se reparten los envíos. Cada archivo sale las veces al día que
                le pidas, y todos se intercalan para que no lleguen de golpe.
              </FieldDescription>

              <Field>
                <FieldLabel htmlFor={`${id}-kind`}>Qué manda</FieldLabel>
                <Select name="kindFilter" defaultValue="ALL">
                  <SelectTrigger id={`${id}-kind`}>
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
          ) : (
            <div className="py-6">
              <Alert>
                <AlertTitle>Falta algo antes</AlertTitle>
                <AlertDescription>
                  Necesitas una{' '}
                  <Link href="/bibliotecas" className="underline underline-offset-4">
                    biblioteca
                  </Link>{' '}
                  que tenga marcado al menos un{' '}
                  <Link href="/destinatarios" className="underline underline-offset-4">
                    destinatario
                  </Link>{' '}
                  ya vinculado. Los destinatarios de cada biblioteca se eligen dentro de ella.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={dialog.close}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!ready || create.isPending || days.length === 0 || endMinute <= startMinute}
            >
              {create.isPending ? <Spinner /> : null}
              Programar
            </Button>
          </DialogFooter>
        </form>
      </MorphDialogContent>
    </Dialog>
  );
}
