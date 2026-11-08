'use client';

import { PASSWORD_MIN_LENGTH, type AuthenticatedUser } from '@reconectate/contracts';
import { useQueryClient } from '@tanstack/react-query';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

      <TimezoneCard />

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

/** Todas las zonas que conoce el navegador; la de la cuenta siempre está. */
function timezones(current: string): string[] {
  const all = Intl.supportedValuesOf('timeZone');

  return all.includes(current) ? all : [current, ...all];
}

/**
 * La zona de la cuenta decide a qué hora termina el día en la bitácora y en
 * `/hoy`. Se guarda al elegirla: no hay nada más que confirmar.
 */
function TimezoneCard() {
  const { user, updateUser } = useSession();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  async function change(timezone: string) {
    setBusy(true);

    try {
      updateUser(
        await api<AuthenticatedUser>('/auth/me/timezone', { method: 'PATCH', body: { timezone } }),
      );
      // Lo que ya estaba cargado se calculó con el «hoy» de la zona anterior.
      await queryClient.invalidateQueries();
      toast.success('Zona horaria guardada.');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'No se pudo guardar la zona.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Zona horaria</CardTitle>
        <CardDescription>
          De ella sale a qué hora termina tu día en la bitácora y en /hoy.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Field>
          <FieldLabel htmlFor="timezone">Dónde vives</FieldLabel>
          <Select
            value={user.timezone}
            onValueChange={(value) => void change(value)}
            disabled={busy}
          >
            <SelectTrigger id="timezone" className="w-full sm:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timezones(user.timezone).map((zone) => (
                <SelectItem key={zone} value={zone}>
                  {zone.replaceAll('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </CardContent>
    </Card>
  );
}
