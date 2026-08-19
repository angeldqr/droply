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
      /*
       * Ya no hay enlace para crear cuenta: las cuentas las crea quien
       * administra. Decirlo acá evita que alguien busque un botón que no existe.
       */
      footer={
        <>
          <Link
            href="/recuperar-contrasena"
            className="text-foreground underline underline-offset-4"
          >
            ¿Olvidaste tu contraseña?
          </Link>
          <span className="mt-2 block">¿No tienes cuenta? Pídesela a quien administra Droply.</span>
        </>
      }
    >
      <SignInForm onDone={() => router.push('/bibliotecas')} />
    </AuthShell>
  );
}
