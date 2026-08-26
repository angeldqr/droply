'use client';

import {
  CHANNEL_LABELS,
  RECIPIENT_LABEL_MAX_LENGTH,
  type RecipientStatus,
  type RecipientView,
} from '@reconectate/contracts';
import { Link2, MailCheck, Plus, Send, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { AppShell } from '@/components/app-shell';
import { MorphDialogContent } from '@/components/morph-dialog-content';
import { RecipientLinkDialog } from '@/components/recipient-link-dialog';
import { RequireSession } from '@/components/require-session';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { api, ApiError } from '@/lib/api';
import { useMorphDialog } from '@/lib/morph-dialog';
import { useSession } from '@/lib/session';
import {
  useCreateRecipient,
  useDeleteRecipient,
  useRecipients,
  useRelinkRecipient,
} from '@/lib/recipients';

export default function RecipientsPage() {
  return (
    <RequireSession>
      <AppShell crumbs={[{ label: 'Destinatarios' }]}>
        <Contents />
      </AppShell>
    </RequireSession>
  );
}

function Contents() {
  const { data, isPending, error } = useRecipients();
  const { user } = useSession();

  /*
   * Sin correo confirmado el servidor rechaza crear destinatarios, y con razón:
   * es lo único que separa esto de una máquina de mandar mensajes a
   * desconocidos desde cuentas desechables. Se dice antes de que lo intente, en
   * vez de dejarle apretar el botón para que se estrelle contra un 412.
   */
  const verified = user?.emailVerified ?? false;

  /*
   * El enlace recién emitido, que se muestra en su propio diálogo.
   *
   * Vive acá arriba porque lo producen dos acciones distintas —crear y pedir
   * uno nuevo— y las dos terminan en la misma pantalla.
   */
  const [issued, setIssued] = useState<RecipientView | null>(null);

  return (
    <div className="mx-auto w-full max-w-[100rem] px-6 py-8 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-4xl">Destinatarios</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            A quién le llegan los envíos. Cada persona tiene que abrir su enlace y apretar Empezar
            en Telegram: hasta entonces el bot no tiene permiso para escribirle.
          </p>
        </div>

        {verified ? (
          <NewRecipientDialog id="nuevo-destinatario-cabecera" onIssued={setIssued} />
        ) : null}
      </div>

      {verified ? null : <VerifyFirst />}

      <div className="mt-10">
        {isPending ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTitle>No pudimos traer tus destinatarios</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ) : data.length === 0 ? (
          <Empty className="border-border border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Send />
              </EmptyMedia>
              <EmptyTitle>Todavía no hay nadie</EmptyTitle>
              <EmptyDescription>
                Agrega a la primera persona y mándale el enlace que te vamos a dar.
              </EmptyDescription>
            </EmptyHeader>
            {verified ? (
              <NewRecipientDialog id="nuevo-destinatario-vacio" onIssued={setIssued} />
            ) : null}
          </Empty>
        ) : (
          <ul className="flex max-w-3xl flex-col gap-2">
            {data.map((recipient) => (
              <li key={recipient.id}>
                <RecipientRow recipient={recipient} onIssued={setIssued} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <RecipientLinkDialog recipient={issued} onOpenChange={() => setIssued(null)} />
    </div>
  );
}

/**
 * Cómo se ve cada estado. En un mapa y no repartido en tres ternarios: la
 * descripción, la etiqueta y su tono son la misma decisión tomada tres veces, y
 * el día que entre BLOCKED —cuando el envío descubra que bloquearon al bot— se
 * agrega una línea acá y no se busca por el archivo.
 */
const STATUS: Readonly<
  Record<RecipientStatus, { badge: string; variant: 'secondary' | 'outline' | 'destructive' }>
> = {
  PENDING: { badge: 'Pendiente', variant: 'outline' },
  VERIFIED: { badge: 'Vinculado', variant: 'secondary' },
  BLOCKED: { badge: 'Te bloqueó', variant: 'destructive' },
};

/**
 * Qué dice la fila debajo del nombre.
 *
 * Un pendiente necesita saber si el enlace que ya mandó sigue vivo: si venció,
 * la otra persona lo va a abrir y no va a pasar nada, y sin decirlo acá no hay
 * forma de enterarse salvo preguntándole.
 */
function describe(recipient: RecipientView): string {
  if (recipient.status === 'VERIFIED') {
    return `${CHANNEL_LABELS[recipient.channel]}, listo para recibir`;
  }

  const expiresAt = recipient.linkExpiresAt ? new Date(recipient.linkExpiresAt) : null;

  if (!expiresAt || expiresAt.getTime() <= Date.now()) {
    return 'Su enlace venció. Genera uno nuevo y vuelve a mandárselo.';
  }

  return `Falta que abra su enlace y apriete Empezar. Vence el ${WHEN.format(expiresAt)}.`;
}

/*
 * La fecha se arma en el navegador y nunca en el servidor: estas filas solo se
 * pintan con sesión resuelta y con la respuesta ya en mano, así que no hay un
 * render del servidor con otra zona horaria del que despegarse.
 */
const WHEN = new Intl.DateTimeFormat('es', { dateStyle: 'long', timeStyle: 'short' });

/**
 * El aviso de que falta confirmar el correo, con la salida a mano.
 *
 * Antes solo decía "ábrelo y vuelve acá", que no sirve de nada a quien perdió
 * ese correo: quedaba encerrado sin forma de salir. El botón vuelve a mandarlo.
 */
function VerifyFirst() {
  const [sending, setSending] = useState(false);

  async function resend() {
    setSending(true);

    try {
      await api<void>('/auth/verify-email/resend', { method: 'POST' });
      toast.success('Te mandamos el enlace otra vez. Revisa tu correo.');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'No se pudo reenviar.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Alert className="mt-6">
      <AlertTitle>Confirma tu correo para agregar destinatarios</AlertTitle>
      <AlertDescription>
        <span>
          Te mandamos un enlace al crear la cuenta. Mientras tanto puedes seguir armando tus
          bibliotecas y tu baúl con normalidad.
        </span>
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-fit"
          disabled={sending}
          onClick={() => void resend()}
        >
          {sending ? <Spinner /> : <MailCheck />}
          Reenviar el correo
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function RecipientRow({
  recipient,
  onIssued,
}: {
  recipient: RecipientView;
  onIssued: (issued: RecipientView) => void;
}) {
  const relink = useRelinkRecipient();
  const remove = useDeleteRecipient();
  const [confirming, setConfirming] = useState(false);

  async function askForLink() {
    try {
      onIssued(await relink.mutateAsync(recipient.id));
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'No se pudo generar el enlace.');
    }
  }

  async function onDelete() {
    try {
      await remove.mutateAsync(recipient.id);
      toast.success(`Se quitó a ${recipient.label}.`);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'No se pudo quitar.');
    }
  }

  return (
    <>
      <Item variant="outline" size="sm" className="bg-card">
        <ItemContent className="min-w-0">
          <ItemTitle className="truncate">{recipient.label}</ItemTitle>
          <ItemDescription>{describe(recipient)}</ItemDescription>
        </ItemContent>

        <ItemActions>
          <Badge variant={STATUS[recipient.status].variant}>{STATUS[recipient.status].badge}</Badge>

          {recipient.status === 'PENDING' ? (
            <Button
              variant="outline"
              size="sm"
              disabled={relink.isPending}
              onClick={() => void askForLink()}
            >
              {relink.isPending ? <Spinner /> : <Link2 />}
              {/*
                "Generar enlace" y no "Ver enlace": el código se guarda hasheado,
                así que no hay ninguno que mostrar. Esto emite uno nuevo y apaga
                el anterior, y el botón tiene que decirlo.
              */}
              Generar enlace
            </Button>
          ) : null}

          <Button
            variant="ghost"
            size="icon"
            aria-label={`Quitar a ${recipient.label}`}
            onClick={() => setConfirming(true)}
          >
            <Trash2 />
          </Button>
        </ItemActions>
      </Item>

      {/*
        Con confirmación, igual que al borrar una biblioteca. Quitar a alguien no
        se deshace: recuperarlo obliga a que la otra persona vuelva a apretar
        Empezar, y eso ya no depende de quien hizo el clic.
      */}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar a {recipient.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              Deja de recibir tus envíos. Para volver a agregarlo tendrás que mandarle un enlace
              nuevo y esperar a que lo abra otra vez.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void onDelete()}
              disabled={remove.isPending}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              {remove.isPending ? <Spinner /> : null}
              Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function NewRecipientDialog({
  id,
  onIssued,
}: {
  id: string;
  onIssued: (issued: RecipientView) => void;
}) {
  const create = useCreateRecipient();
  const dialog = useMorphDialog(id);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      const created = await create.mutateAsync({ label: String(form.get('label')) });

      dialog.close();
      onIssued(created);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'No se pudo agregar.');
    }
  }

  return (
    <Dialog open={dialog.open} onOpenChange={dialog.onOpenChange}>
      <DialogTrigger asChild>
        <Button {...dialog.fromProps}>
          {/* Blendy necesita que el contenido cuelgue de un solo elemento. */}
          <span className="flex items-center gap-2">
            <Plus /> Nuevo destinatario
          </span>
        </Button>
      </DialogTrigger>

      <MorphDialogContent toProps={dialog.toProps}>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Nuevo destinatario</DialogTitle>
            <DialogDescription>
              Ponle el nombre con el que lo reconozcas. Después te damos el enlace para mandarle.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-6">
            <Field>
              <FieldLabel htmlFor={`${id}-label`}>Nombre de quien recibe</FieldLabel>
              <Input
                id={`${id}-label`}
                name="label"
                autoFocus
                required
                maxLength={RECIPIENT_LABEL_MAX_LENGTH}
                placeholder="Mamá"
              />
              <FieldDescription>Es solo para ti: la otra persona nunca lo ve.</FieldDescription>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={dialog.close}>
              Cancelar
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? <Spinner /> : null}
              Agregar
            </Button>
          </DialogFooter>
        </form>
      </MorphDialogContent>
    </Dialog>
  );
}
