'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { useSession } from '@/lib/session';

/**
 * Mientras se resuelve si había sesión no se decide nada: mandar a la pantalla
 * de entrada durante ese instante haría que recargar dentro de la aplicación
 * te expulse aunque tu sesión siga viva.
 */
export function RequireSession({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/entrar');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-6" />
        <span className="sr-only">Cargando tu sesión</span>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Lo contrario, para la portada y «Entrar»: quien vuelve con su sesión viva
 * (la cookie dura 30 días) va directo a Inicio en vez de ver «Iniciar sesión»,
 * que le haría creer que lo sacaron. Mientras se resuelve, la página se ve igual.
 */
export function RedirectIfSignedIn() {
  const { user, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace('/inicio');
  }, [loading, user, router]);

  return null;
}
