'use client';

import {
  PASSWORD_MIN_LENGTH,
  type AccountSummaryView,
  type RegisterInput,
} from '@reconectate/contracts';
import { ChevronRight, ShieldCheck, UserPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { AppShell } from '@/components/app-shell';
import { MorphDialogContent } from '@/components/morph-dialog-content';
import { RequireSession } from '@/components/require-session';
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { AccountActions } from '@/components/account-actions';
import { useAccount, useAccounts, useCreateAccount } from '@/lib/admin';
import { ApiError } from '@/lib/api';
import { useMorphDialog } from '@/lib/morph-dialog';
import { useSession } from '@/lib/session';

export default function AdminPage() {
  return (
    <RequireSession>
      <AppShell crumbs={[{ label: 'Administración' }]}>
        <Contents />
      </AppShell>
    </RequireSession>
  );
}

function Contents() {
  const { user } = useSession();
  const accounts = useAccounts();
  const [openId, setOpenId] = useState<string | null>(null);

  /*
   * La pantalla se cierra en el cliente **y** en el servidor. Esto es cortesía
   * —evita un panel vacío lleno de errores—; la puerta de verdad es el
   * `@Roles('ADMIN')` de cada ruta, que no depende de lo que crea el navegador.
   */
  if (user && user.role !== 'ADMIN') {
    return (
      <div className="mx-auto w-full max-w-[100rem] px-6 py-8 md:px-10">
        <Alert variant="destructive">
          <AlertTitle>Esta sección no es para tu cuenta</AlertTitle>
          <AlertDescription>Solo quien administra Reconéctate puede entrar acá.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[100rem] px-6 py-8 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-4xl">Administración</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Las cuentas del sistema y lo que tiene cada una. Se ve cuánto hay, no qué hay: ni los
            textos ni los archivos de nadie se abren desde acá.
          </p>
        </div>

        <NewAccountDialog />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          {accounts.isPending ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-20 w-full" />
              ))}
            </div>
          ) : accounts.error ? (
            <Alert variant="destructive">
              <AlertTitle>No pudimos traer las cuentas</AlertTitle>
              <AlertDescription>{accounts.error.message}</AlertDescription>
            </Alert>
          ) : (
            <ul className="flex flex-col gap-2">
              {accounts.data.map((account) => (
                <li key={account.id}>
                  <AccountRow
                    account={account}
                    open={openId === account.id}
                    onOpen={() => setOpenId(account.id === openId ? null : account.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <AccountDetail userId={openId} />
      </div>
    </div>
  );
}

function AccountRow({
  account,
  open,
  onOpen,
}: {
  account: AccountSummaryView;
  open: boolean;
  onOpen: () => void;
}) {
  return (
    <Item variant="outline" size="sm" className={open ? 'bg-muted' : 'bg-card'}>
      <ItemContent className="min-w-0">
        <ItemTitle className="flex items-center gap-2 truncate">
          {account.displayName}
          {account.role === 'ADMIN' ? (
            <Badge variant="secondary" className="gap-1">
              <ShieldCheck className="size-3" /> Administra
            </Badge>
          ) : null}
          {account.emailVerified ? null : <Badge variant="outline">Sin confirmar</Badge>}
          {account.active ? null : <Badge variant="destructive">Sin acceso</Badge>}
        </ItemTitle>
        <ItemDescription className="truncate">{account.email}</ItemDescription>
        <ItemDescription>
          {account.libraryCount} bibliotecas · {account.recipientCount} destinatarios ·{' '}
          {account.scheduleCount} horarios · baúl con {account.vaultItemCount}
        </ItemDescription>
      </ItemContent>

      <ItemActions>
        <AccountActions account={account} />

        <Button variant="ghost" size="icon" onClick={onOpen} aria-label={`Ver ${account.email}`}>
          <ChevronRight
            className={open ? 'rotate-90 transition-transform' : 'transition-transform'}
          />
        </Button>
      </ItemActions>
    </Item>
  );
}

function AccountDetail({ userId }: { userId: string | null }) {
  const account = useAccount(userId);

  if (!userId) {
    return (
      <p className="text-muted-foreground border-border hidden rounded-lg border border-dashed p-6 text-sm lg:block">
        Elige una cuenta para ver sus bibliotecas y sus destinatarios.
      </p>
    );
  }

  if (account.isPending) return <Skeleton className="h-64 w-full" />;

  if (account.error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>No pudimos abrir esa cuenta</AlertTitle>
        <AlertDescription>{account.error.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="border-border flex flex-col gap-6 rounded-lg border p-6">
      <div>
        <h2 className="text-2xl">{account.data.displayName}</h2>
        <p className="text-muted-foreground text-sm">{account.data.email}</p>
      </div>

      <section>
        <h3 className="text-muted-foreground mb-2 text-xs uppercase tracking-wider">Bibliotecas</h3>
        {account.data.libraries.length === 0 ? (
          <p className="text-muted-foreground text-sm">Ninguna todavía.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {account.data.libraries.map((library) => (
              <li key={library.id} className="border-border rounded-md border px-3 py-2">
                <p className="truncate text-sm">{library.name}</p>
                {library.description ? (
                  <p className="text-muted-foreground truncate text-xs">{library.description}</p>
                ) : null}
                <p className="text-muted-foreground text-xs">
                  {library.itemCount} elementos · {library.recipientCount} destinatarios
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-muted-foreground mb-2 text-xs uppercase tracking-wider">
          Destinatarios
        </h3>
        {account.data.recipients.length === 0 ? (
          <p className="text-muted-foreground text-sm">Ninguno todavía.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {account.data.recipients.map((recipient) => (
              <li key={recipient.id}>
                <Badge variant={recipient.linked ? 'secondary' : 'outline'}>
                  {recipient.label}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-muted-foreground mb-2 text-xs uppercase tracking-wider">Baúl</h3>
        <p className="text-muted-foreground text-sm">
          {account.data.vaultItemCount} elementos guardados. Su contenido es personal y no se
          muestra acá.
        </p>
      </section>
    </div>
  );
}

function NewAccountDialog() {
  const create = useCreateAccount();
  const dialog = useMorphDialog('nueva-cuenta');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const input: RegisterInput = {
      email: String(form.get('email')),
      password: String(form.get('password')),
      displayName: String(form.get('displayName')),
      // La zona de quien crea la cuenta es la mejor conjetura: quien la use la
      // cambia después, y es mejor que dejarla en una que no es de nadie.
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    try {
      await create.mutateAsync(input);
      toast.success(`Cuenta creada para ${input.email}. Pásale la contraseña.`);
      dialog.close();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'No se pudo crear la cuenta.');
    }
  }

  return (
    <Dialog open={dialog.open} onOpenChange={dialog.onOpenChange}>
      <DialogTrigger asChild>
        <Button {...dialog.fromProps}>
          {/* Blendy necesita que el contenido cuelgue de un solo elemento. */}
          <span className="flex items-center gap-2">
            <UserPlus /> Nueva cuenta
          </span>
        </Button>
      </DialogTrigger>

      <MorphDialogContent toProps={dialog.toProps}>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Nueva cuenta</DialogTitle>
            <DialogDescription>
              La contraseña la eliges tú y se la pasas a esa persona. No hay registro abierto.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-6">
            <Field>
              <FieldLabel htmlFor="displayName">Nombre</FieldLabel>
              <Input id="displayName" name="displayName" autoFocus required maxLength={80} />
            </Field>

            <Field>
              <FieldLabel htmlFor="email">Correo</FieldLabel>
              <Input id="email" name="email" type="email" required />
            </Field>

            <Field>
              <FieldLabel htmlFor="password">Contraseña</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={PASSWORD_MIN_LENGTH}
              />
              <FieldDescription>
                Al menos {PASSWORD_MIN_LENGTH} caracteres. Una frase larga sirve mejor que un
                revoltijo corto.
              </FieldDescription>
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
