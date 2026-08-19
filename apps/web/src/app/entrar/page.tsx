'use client';

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
      footer={<>¿No tienes cuenta? Pídesela a quien administra Droply.</>}
    >
      <SignInForm onDone={() => router.push('/bibliotecas')} />
    </AuthShell>
  );
}
