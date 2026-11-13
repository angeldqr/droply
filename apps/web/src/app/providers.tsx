'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig, MotionGlobalConfig } from 'motion/react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AssistantWidget } from '@/components/assistant-widget';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ApiError } from '@/lib/api';
import { SessionProvider, useSession } from '@/lib/session';

export function Providers({ children }: { children: React.ReactNode }) {
  // El cliente se crea una sola vez por montaje: fuera del componente sería
  // compartido entre peticiones del servidor y filtraría datos entre usuarios.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (failureCount, error) => {
              // Reintentar un 401 o un 404 no cambia nada; solo demora el error.
              if (error instanceof ApiError && error.status < 500) return false;

              return failureCount < 2;
            },
          },
        },
      }),
  );

  /*
   * `reducedMotion="user"` de más abajo solo quita lo que se desplaza o se
   * estira: los fundidos y los desenfoques siguen animándose. Con «reducir
   * movimiento» se saltan todas las animaciones de `motion`, que es lo que la
   * regla de CSS ya hace con las demás: el contenido aparece en su sitio.
   */
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      MotionGlobalConfig.skipAnimations = preference.matches;
    };

    apply();
    preference.addEventListener('change', apply);

    return () => preference.removeEventListener('change', apply);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        {/*
          Con «reducir movimiento» en el sistema, motion deja solo los fundidos:
          nada se desliza, se estira ni rebota. Sin esto el menú lateral y las
          listas se movían igual.
        */}
        <MotionConfig reducedMotion="user">
          <TooltipProvider delayDuration={300}>
            {children}
            <SignedInAssistant />
            {/* Al centro y no a la derecha: abajo a la derecha está el botón del asistente. */}
            <Toaster position="bottom-center" />
          </TooltipProvider>
        </MotionConfig>
      </SessionProvider>
    </QueryClientProvider>
  );
}

/** Las pantallas de fuera de la aplicación: la portada y las de entrar. */
const PUBLIC_PATHS = new Set([
  '/',
  '/entrar',
  '/recuperar-contrasena',
  '/restablecer-contrasena',
  '/verificar-correo',
]);

/**
 * El asistente, solo con sesión y dentro de la aplicación. Al cerrar sesión se
 * desmonta y la conversación se va con él: lo que preguntó una cuenta no lo ve
 * la siguiente.
 *
 * La sesión sola no alcanza: con la cookie de una visita anterior la sesión se
 * restaura también en la portada y en "Entrar", donde el botón no tiene sentido.
 */
function SignedInAssistant() {
  const { user } = useSession();
  const pathname = usePathname();

  return user && !PUBLIC_PATHS.has(pathname) ? <AssistantWidget /> : null;
}
