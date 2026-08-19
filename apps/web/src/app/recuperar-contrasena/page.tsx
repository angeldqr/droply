'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { AuthShell } from '@/components/auth-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { ApiError, api } from '@/lib/api';

/**
 * Pide el enlace para volver a poner la contraseña.
 *
 * **Dice lo mismo exista la cuenta o no.** No es pereza: contestar distinto
 * convertiría esta pantalla en un buscador de correos registrados. Por eso el
 * mensaje de después habla de "si esa cuenta existe" y no de "te lo mandamos".
 */
export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');

    const email = String(new FormData(event.currentTarget).get('email'));

    try {
      await api('/auth/password/forgot', { method: 'POST', body: { email } });
      setSent(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos hablar con el servidor.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={sent ? 'Mira tu correo' : 'Volver a entrar'}
      description={
        sent
          ? 'Si esa cuenta existe, ya salió un enlace hacia ella.'
          : 'Te mandamos un enlace para poner una contraseña nueva.'
      }
      footer={
        <Link href="/entrar" className="text-foreground underline underline-offset-4">
          Volver a entrar
        </Link>
      }
    >
      {sent ? (
        <Alert>
          <AlertTitle>Revisa tu bandeja</AlertTitle>
          <AlertDescription>
            El enlace vence en una hora y sirve una sola vez. Si no llega, mira en el correo no
            deseado o pídele a quien administra que te ponga una contraseña nueva.
          </AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={(event) => void onSubmit(event)}>
          <FieldGroup>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <Field>
              <FieldLabel htmlFor="email">Tu correo</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="tu@correo.com"
              />
            </Field>

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Spinner /> : null}
              Mandar el enlace
            </Button>
          </FieldGroup>
        </form>
      )}
    </AuthShell>
  );
}
