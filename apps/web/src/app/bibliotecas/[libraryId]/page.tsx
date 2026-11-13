'use client';

import { COLUMN_ORDER, countLabel } from '@reconectate/contracts';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { LibraryActions } from '@/components/library-actions';
import { LibraryBoard } from '@/components/library-board';
import { LibraryRecipientsDialog } from '@/components/library-recipients-dialog';
import { RequireSession } from '@/components/require-session';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { COLUMN_TINT } from '@/lib/columns';
import { useLibrary } from '@/lib/libraries';

export default function LibraryPage() {
  const params = useParams<{ libraryId: string }>();

  return (
    <RequireSession>
      <Board libraryId={params.libraryId} />
    </RequireSession>
  );
}

/*
 * El armazón se arma acá dentro y no en la página, porque el rastro de la
 * cabecera necesita el nombre de la biblioteca y ese nombre sale de la misma
 * consulta que el tablero. Pedirlo desde la página la dejaría disparando antes
 * de que `RequireSession` confirme que hay sesión: un 401 en cada visita.
 */
function Board({ libraryId }: { libraryId: string }) {
  const router = useRouter();
  const { data, isPending, error } = useLibrary(libraryId);

  const crumbs = [
    { label: 'Bibliotecas', href: '/bibliotecas' },
    { label: data?.name ?? 'Biblioteca' },
  ];

  if (isPending) {
    return (
      <AppShell crumbs={crumbs}>
        <div className="w-full pb-6 pt-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="mt-4 h-4 w-96" />
          <Skeleton className="mt-8 h-[28rem] w-full" />
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell crumbs={crumbs}>
        <div className="w-full pb-6 pt-2">
          <Alert variant="destructive">
            <AlertTitle>No pudimos abrir esta biblioteca</AlertTitle>
            <AlertDescription>
              {error.message}{' '}
              <Link href="/bibliotecas" className="underline underline-offset-4">
                Volver al listado
              </Link>
            </AlertDescription>
          </Alert>
        </div>
      </AppShell>
    );
  }

  const total = COLUMN_ORDER.reduce((sum, kind) => sum + data.counts[kind], 0);

  return (
    <AppShell
      crumbs={crumbs}
      // Lo que se hace con la biblioteca entera va junto a su nombre, en la barra.
      actions={
        <>
          {COLUMN_ORDER.filter((kind) => data.counts[kind] > 0).map((kind) => (
            // En el teléfono no caben en la barra; las columnas ya dicen cuántos hay.
            <Badge
              key={kind}
              variant="secondary"
              className={`hidden sm:inline-flex ${COLUMN_TINT[kind]}`}
            >
              {countLabel(kind, data.counts[kind])}
            </Badge>
          ))}
          <LibraryRecipientsDialog library={data} />
          <LibraryActions library={data} onDeleted={() => router.push('/bibliotecas')} />
        </>
      }
    >
      <div className="w-full pb-6 pt-2">
        {data.description ? (
          <p className="text-muted-foreground max-w-2xl break-words">{data.description}</p>
        ) : null}

        <p className="text-muted-foreground mt-2 text-sm">
          {total === 0
            ? 'Todavía está vacía. Agrega lo primero desde el signo de más.'
            : `${total} ${total === 1 ? 'elemento' : 'elementos'}. Cada uno sale las veces al día que le pidas.`}
        </p>

        <div className="mt-6">
          <LibraryBoard libraryId={libraryId} items={data.items} />
        </div>
      </div>
    </AppShell>
  );
}
