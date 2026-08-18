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
