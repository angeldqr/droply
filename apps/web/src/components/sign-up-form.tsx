'use client';

import { PASSWORD_MIN_LENGTH } from '@droply/contracts';
import { useState, type FormEvent } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';

/** `FieldError` espera una lista; acá siempre viene un mensaje o ninguno. */
function mensaje(texto: string | undefined) {
  return texto ? [{ message: texto }] : undefined;
}

/** La zona del navegador acierta casi siempre y evita un selector más. */
function detectedTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota';
}

/**
 * El formulario de registro, sin marco propio: se usa igual en `/crear-cuenta`
 * que en el diálogo de la portada, y los identificadores llevan prefijo por la
 * misma razón que en el de entrada.
 */
export function SignUpForm({ onDone }: { onDone: () => void }) {
  const { signIn } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [working, setWorking] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFields({});
    setWorking(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get('email'));
    const password = String(form.get('password'));

    try {
      await api('/auth/register', {
        method: 'POST',
        body: {
          email,
          password,
          displayName: String(form.get('displayName')),
          timezone: detectedTimezone(),
        },
      });

      // Entra directo: verificar el correo hace falta para programar envíos,
      // no para armar bibliotecas.
      await signIn({ email, password });
      onDone();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFields(caught.fields);
      } else {
        setError('No pudimos hablar con el servidor.');
      }

      setWorking(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(fields['displayName'])}>
          <FieldLabel htmlFor="crear-displayName">Cómo te llamamos</FieldLabel>
          <Input
            id="crear-displayName"
            name="displayName"
            autoComplete="name"
            aria-invalid={Boolean(fields['displayName'])}
            required
          />
          <FieldError errors={mensaje(fields['displayName'])} />
        </Field>

        <Field data-invalid={Boolean(fields['email'])}>
          <FieldLabel htmlFor="crear-email">Correo</FieldLabel>
          <Input
            id="crear-email"
            name="email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(fields['email'])}
            required
          />
          <FieldError errors={mensaje(fields['email'])} />
        </Field>

        <Field data-invalid={Boolean(fields['password'])}>
          <FieldLabel htmlFor="crear-password">Contraseña</FieldLabel>
          <Input
            id="crear-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            aria-invalid={Boolean(fields['password'])}
            required
          />
          <FieldDescription>
            Al menos {PASSWORD_MIN_LENGTH} caracteres. Una frase corriente sirve y se recuerda
            mejor.
          </FieldDescription>
          <FieldError errors={mensaje(fields['password'])} />
        </Field>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" disabled={working} className="w-full">
          {working ? <Spinner /> : null}
          Crear cuenta
        </Button>
      </FieldGroup>
    </form>
  );
}
