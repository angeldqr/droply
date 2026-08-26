'use client';

import { COLUMN_ORDER, countLabel } from '@reconectate/contracts';
import { AppShell } from '@/components/app-shell';
import { LibraryBoard } from '@/components/library-board';
import { RequireSession } from '@/components/require-session';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { COLUMN_TINT } from '@/lib/columns';
import { useVault } from '@/lib/libraries';

/**
 * El baúl: todo lo que la cuenta tiene guardado, sin pertenecer todavía a
 * ninguna biblioteca.
 *
 * Es el mismo tablero de una biblioteca porque por dentro es una biblioteca
 * más, solo que marcada. Así subir, escribir, ordenar y quitar funcionan igual
 * sin una segunda mitad de la aplicación que mantener en paralelo.
 */
export default function VaultPage() {
  return (
    <RequireSession>
      <AppShell crumbs={[{ label: 'Baúl' }]}>
        <Contents />
      </AppShell>
    </RequireSession>
  );
}

function Contents() {
  const { data, isPending, error } = useVault();

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-[100rem] px-6 py-8 md:px-10">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-4 h-4 w-96" />
        <Skeleton className="mt-8 h-[28rem] w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[100rem] px-6 py-8 md:px-10">
        <Alert variant="destructive">
          <AlertTitle>No pudimos abrir tu baúl</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const total = COLUMN_ORDER.reduce((sum, kind) => sum + data.counts[kind], 0);

  return (
    <div className="mx-auto w-full max-w-[100rem] px-6 py-8 md:px-10">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-4xl">Baúl</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Lo que guardas acá no se envía: queda a mano para meterlo en cualquier biblioteca sin
            volver a subirlo desde tu equipo.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {COLUMN_ORDER.filter((kind) => data.counts[kind] > 0).map((kind) => (
            <Badge key={kind} variant="secondary" className={COLUMN_TINT[kind]}>
              {countLabel(kind, data.counts[kind])}
            </Badge>
          ))}
        </div>
      </div>

      <p className="text-muted-foreground mt-6 text-sm">
        {total === 0
          ? 'Todavía está vacío. Sube lo primero desde el signo de más.'
          : `${total} ${total === 1 ? 'elemento' : 'elementos'} guardados.`}
      </p>

      <div className="mt-6">
        <LibraryBoard libraryId={data.id} items={data.items} isVault />
      </div>
    </div>
  );
}
