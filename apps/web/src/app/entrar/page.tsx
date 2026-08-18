'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { SignInForm } from '@/components/sign-in-form';

export default function EntrarPage() {
  const router = useRouter();

  return (
    <AuthShell
      title="Entrar"
      description="Vuelve a tus bibliotecas."
      footer={
        <>
          ¿Todavía no tienes cuenta?{' '}
          <Link href="/crear-cuenta" className="text-foreground underline underline-offset-4">
            Crea una
          </Link>
        </>
      }
    >
      <SignInForm onDone={() => router.push('/bibliotecas')} />
    </AuthShell>
  );
}
