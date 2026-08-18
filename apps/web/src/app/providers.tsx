'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ApiError } from '@/lib/api';
import { SessionProvider } from '@/lib/session';

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
        <TooltipProvider delayDuration={300}>
          {children}
          <Toaster position="bottom-right" />
        </TooltipProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
