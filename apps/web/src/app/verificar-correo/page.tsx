'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { AuthShell } from '@/components/auth-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { ApiError, api } from '@/lib/api';

type Status = 'checking' | 'done' | 'failed';

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <Verify />
    </Suspense>
  );
}

function Verify() {
  const token = useSearchParams().get('token');
  const [status, setStatus] = useState<Status>('checking');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('failed');
      setMessage('Al enlace le falta el código. Cópialo completo desde el correo.');

      return;
    }

    let cancelled = false;

    const confirm = async () => {
      try {
        await api('/auth/verify-email', { method: 'POST', body: { token } });
        if (!cancelled) setStatus('done');
      } catch (caught) {
        if (cancelled) return;

        setStatus('failed');
        setMessage(
          caught instanceof ApiError ? caught.message : 'No pudimos hablar con el servidor.',
        );
      }
    };

    void confirm();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <AuthShell
      title={status === 'done' ? 'Correo confirmado' : 'Confirmando tu correo'}
      description={status === 'done' ? 'Ya puedes programar envíos.' : 'Esto toma un segundo.'}
      footer={
        <Link href="/bibliotecas" className="text-foreground underline underline-offset-4">
          Ir a tus bibliotecas
        </Link>
      }
    >
      {status === 'checking' ? (
        <div className="flex justify-center py-4">
          <Spinner className="size-6" />
        </div>
      ) : status === 'failed' ? (
        <Alert variant="destructive">
          <AlertTitle>Ese enlace no sirve</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : (
        <Button asChild className="w-full">
          <Link href="/bibliotecas">Seguir</Link>
        </Button>
      )}
    </AuthShell>
  );
}
