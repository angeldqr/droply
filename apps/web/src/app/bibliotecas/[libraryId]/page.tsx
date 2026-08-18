'use client';

import { COLUMN_ORDER, countLabel } from '@droply/contracts';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppHeader } from '@/components/app-header';
import { LibraryBoard } from '@/components/library-board';
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
      <AppHeader />
      <Board libraryId={params.libraryId} />
    </RequireSession>
  );
}

function Board({ libraryId }: { libraryId: string }) {
  const { data, isPending, error } = useLibrary(libraryId);

  if (isPending) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-4 h-4 w-96" />
        <Skeleton className="mt-8 h-[28rem] w-full" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Alert variant="destructive">
          <AlertTitle>No pudimos abrir esta biblioteca</AlertTitle>
          <AlertDescription>
            {error.message}{' '}
            <Link href="/bibliotecas" className="underline underline-offset-4">
              Volver al listado
            </Link>
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  const total = COLUMN_ORDER.reduce((sum, kind) => sum + data.counts[kind], 0);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link
        href="/bibliotecas"
        className="text-muted-foreground hover:text-foreground text-sm transition-colors"
      >
        ← Bibliotecas
      </Link>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-4xl">{data.name}</h1>
          {data.description ? (
            <p className="text-muted-foreground mt-2 max-w-2xl">{data.description}</p>
          ) : null}
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
          ? 'Todavía está vacía. Agrega lo primero desde el signo de más.'
          : `${total} ${total === 1 ? 'elemento' : 'elementos'}. El bot elige uno al azar en cada envío.`}
      </p>

      <div className="mt-6">
        <LibraryBoard libraryId={libraryId} items={data.items} />
      </div>
    </main>
  );
}
