'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { SignUpForm } from '@/components/sign-up-form';

export default function CrearCuentaPage() {
  const router = useRouter();

  return (
    <AuthShell
      title="Crear cuenta"
      description="Arma tu primera biblioteca en un minuto."
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link href="/entrar" className="text-foreground underline underline-offset-4">
            Entra
          </Link>
        </>
      }
    >
      <SignUpForm onDone={() => router.push('/bibliotecas')} />
    </AuthShell>
  );
}
