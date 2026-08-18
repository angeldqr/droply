'use client';

import { useState, type FormEvent } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';

/**
 * El formulario de entrada, sin marco propio: lo mismo sirve dentro de la
 * tarjeta de `/entrar` que dentro del diálogo de la portada, y así el día que
 * cambie un campo cambia en un solo lugar.
 *
 * Los identificadores llevan prefijo para no depender de que las pestañas de
 * la portada desmonten el formulario que no se ve: si algún día los dos quedan
 * en el mismo documento, dos `id="email"` romperían la relación entre etiqueta
 * y campo.
 */
export function SignInForm({ onDone }: { onDone: () => void }) {
  const { signIn } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setWorking(true);

    const form = new FormData(event.currentTarget);

    try {
      await signIn({
        email: String(form.get('email')),
        password: String(form.get('password')),
      });

      onDone();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos hablar con el servidor.');
      setWorking(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="entrar-email">Correo</FieldLabel>
          <Input id="entrar-email" name="email" type="email" autoComplete="email" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="entrar-password">Contraseña</FieldLabel>
          <Input
            id="entrar-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" disabled={working} className="w-full">
          {working ? <Spinner /> : null}
          Entrar
        </Button>
      </FieldGroup>
    </form>
  );
}
