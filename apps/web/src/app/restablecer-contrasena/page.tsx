'use client';

import { PASSWORD_MIN_LENGTH } from '@droply/contracts';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { AuthShell } from '@/components/auth-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { ApiError, api } from '@/lib/api';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPassword />
    </Suspense>
  );
}

function ResetPassword() {
  const token = useSearchParams().get('token');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');

    const password = String(new FormData(event.currentTarget).get('password'));

    try {
      await api('/auth/password/reset', { method: 'POST', body: { token, password } });
      setDone(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos hablar con el servidor.');
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <AuthShell
        title="Falta el código"
        description="Al enlace le falta un pedazo."
        footer={
          <Link
            href="/recuperar-contrasena"
            className="text-foreground underline underline-offset-4"
          >
            Pedir otro enlace
          </Link>
        }
      >
        <Alert variant="destructive">
          <AlertTitle>Ese enlace está incompleto</AlertTitle>
          <AlertDescription>Cópialo entero desde el correo, o pide uno nuevo.</AlertDescription>
        </Alert>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={done ? 'Contraseña cambiada' : 'Pon una contraseña nueva'}
      description={
        done
          ? 'Se cerraron todas las sesiones abiertas. Entra con la nueva.'
          : 'La de antes deja de valer en cuanto guardes esta.'
      }
      footer={
        <Link href="/entrar" className="text-foreground underline underline-offset-4">
          Ir a entrar
        </Link>
      }
    >
      {done ? (
        <Button asChild className="w-full">
          <Link href="/entrar">Entrar</Link>
        </Button>
      ) : (
        <form onSubmit={(event) => void onSubmit(event)}>
          <FieldGroup>
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>Ese enlace ya no sirve</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <Field>
              <FieldLabel htmlFor="password">Contraseña nueva</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={PASSWORD_MIN_LENGTH}
              />
              <FieldDescription>
                Al menos {PASSWORD_MIN_LENGTH} caracteres. Una frase que recuerdes vale más que algo
                corto y raro.
              </FieldDescription>
            </Field>

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Spinner /> : null}
              Guardar
            </Button>
          </FieldGroup>
        </form>
      )}
    </AuthShell>
  );
}
