'use client';

import { PASSWORD_MIN_LENGTH } from '@droply/contracts';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { AppShell } from '@/components/app-shell';
import { RequireSession } from '@/components/require-session';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Item, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { Spinner } from '@/components/ui/spinner';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';

export default function AccountPage() {
  return (
    <RequireSession>
      <AppShell crumbs={[{ label: 'Tu cuenta' }]}>
        <Account />
      </AppShell>
    </RequireSession>
  );
}

function Account() {
  const { user, signOut } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');

    const form = new FormData(event.currentTarget);

    try {
      await api('/auth/password', {
        method: 'POST',
        body: {
          currentPassword: String(form.get('currentPassword')),
          newPassword: String(form.get('newPassword')),
        },
      });

      /*
       * Cambiar la contraseña cierra todas las sesiones, incluida esta. Sacar
       * al usuario a la pantalla de entrar es lo honesto: si se quedara acá,
       * la siguiente cosa que tocara fallaría sin explicación.
       */
      toast.success('Contraseña cambiada. Entra con la nueva.');
      await signOut();
      router.push('/entrar');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos hablar con el servidor.');
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 md:px-6">
      <Item variant="outline" size="sm" className="bg-card mb-6 items-start">
        <ItemContent className="min-w-0">
          <ItemTitle className="truncate">{user?.displayName}</ItemTitle>
          <ItemDescription className="truncate">{user?.email}</ItemDescription>
        </ItemContent>
      </Item>

      <Card>
        <CardHeader>
          <CardTitle>Cambiar la contraseña</CardTitle>
          <CardDescription>
            Se cierran todas las sesiones abiertas, así que tendrás que entrar otra vez.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={(event) => void onSubmit(event)}>
            <FieldGroup>
              {error ? (
                <Alert variant="destructive">
                  <AlertTitle>No se pudo cambiar</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <Field>
                <FieldLabel htmlFor="currentPassword">Tu contraseña actual</FieldLabel>
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                />
                <FieldDescription>
                  Se pide aunque ya estés dentro: sin ella, quien se siente frente a tu pantalla
                  desbloqueada se lleva la cuenta.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="newPassword">La nueva</FieldLabel>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                />
                <FieldDescription>Al menos {PASSWORD_MIN_LENGTH} caracteres.</FieldDescription>
              </Field>

              <Button type="submit" disabled={busy} className="self-start">
                {busy ? <Spinner /> : null}
                Cambiar la contraseña
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
