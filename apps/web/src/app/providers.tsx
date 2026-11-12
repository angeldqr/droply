'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { useState } from 'react';
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

/**
 * El asistente, solo con sesión. Al cerrarla se desmonta y la conversación se
 * va con él: lo que preguntó una cuenta no lo ve la siguiente.
 */
function SignedInAssistant() {
  const { user } = useSession();

  return user ? <AssistantWidget /> : null;
}
