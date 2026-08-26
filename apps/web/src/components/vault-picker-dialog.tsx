'use client';

import { COLUMN_LABELS, type ItemKind, type LibraryItemView } from '@reconectate/contracts';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { MorphDialogContent } from '@/components/morph-dialog-content';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Button } from '@/components/ui/button';
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { ApiError } from '@/lib/api';
import { useCopyFromVault, useVault } from '@/lib/libraries';

/**
 * Elegir del baúl lo que va a esta columna.
 *
 * Cada elemento se muestra como se va a ver en la biblioteca —la imagen, el
 * video con su primer fotograma, el audio con su reproductor, el texto
 * entero— porque el nombre de archivo no alcanza para reconocer cuál de los
 * cuatro paisajes es el que se quería. Por eso el diálogo es más ancho que los
 * demás: una rejilla de miniaturas dentro de una caja de formulario obligaría a
 * mirarlas de a una.
 *
 * Solo se listan los elementos de la columna desde la que se abrió: el baúl
 * entero en una lista sola obligaría a buscar el audio entre las imágenes.
 *
 * Lo que se elige se **copia**: el baúl sigue teniendo lo suyo, y quitarlo de la
 * biblioteca no lo saca del baúl.
 */
export function VaultPickerDialog({
  libraryId,
  kind,
  open,
  onOpenChange,
  onPicked,
  toProps,
}: {
  libraryId: string;
  kind: ItemKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPicked: () => void;
  toProps: { 'data-blendy-to': string };
}) {
  const vault = useVault();
  const copy = useCopyFromVault(libraryId);
  /** Cuál se está copiando, para que gire el indicador solo en esa tarjeta. */
  const [adding, setAdding] = useState<string | null>(null);

  async function pick(sourceItemId: string) {
    setAdding(sourceItemId);

    try {
      await copy.mutateAsync({ sourceItemId });
      onPicked();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'No se pudo traer del baúl.');
    } finally {
      setAdding(null);
    }
  }

  const column = vault.data?.items.filter((item) => item.kind === kind) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <MorphDialogContent toProps={toProps} className="sm:max-w-3xl">
        <div>
          <DialogHeader>
            <DialogTitle>Traer del baúl</DialogTitle>
            <DialogDescription>
              {COLUMN_LABELS[kind]} que ya tienes guardados. Se copian, así que el baúl se queda con
              los suyos.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto py-6">
            {vault.isPending ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((index) => (
                  <Skeleton key={index} className="h-44 w-full" />
                ))}
              </div>
            ) : vault.error ? (
              <p className="text-destructive text-sm">{vault.error.message}</p>
            ) : column.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Nada por acá</EmptyTitle>
                  <EmptyDescription>
                    Tu baúl todavía no tiene {COLUMN_LABELS[kind].toLowerCase()}.{' '}
                    <Link href="/baul" className="underline underline-offset-4">
                      Ir al baúl
                    </Link>
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {column.map((item) => (
                  <li
                    key={item.id}
                    className="border-border bg-card flex flex-col gap-2 rounded-lg border p-2"
                  >
                    <Preview item={item} />

                    <p
                      className="truncate px-1 text-xs"
                      title={item.media?.fileName ?? item.text ?? ''}
                    >
                      {item.media?.fileName ?? item.text}
                    </p>

                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={adding !== null}
                      onClick={() => void pick(item.id)}
                    >
                      {adding === item.id ? <Spinner /> : <Plus />}
                      Agregar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </MorphDialogContent>
    </Dialog>
  );
}

/**
 * La vista previa dentro de la tarjeta del selector.
 *
 * El video va sin controles y silenciado: acá solo hace falta el fotograma para
 * reconocerlo, y diez reproductores con sonido a la vez son una trampa. El
 * audio sí los lleva, porque un audio no se reconoce mirándolo.
 */
function Preview({ item }: { item: LibraryItemView }) {
  if (item.kind === 'TEXT') {
    return (
      <div className="bg-muted text-foreground line-clamp-6 whitespace-pre-wrap break-words rounded-md p-3 text-sm">
        {item.text}
      </div>
    );
  }

  const url = item.media?.url ?? null;

  if (url === null) {
    return (
      <AspectRatio ratio={16 / 9} className="bg-muted grid place-items-center rounded-md">
        <span className="text-muted-foreground px-2 text-center text-xs">
          Se quedó a medias en el baúl
        </span>
      </AspectRatio>
    );
  }

  if (item.kind === 'AUDIO') {
    return (
      <div className="bg-muted grid place-items-center rounded-md p-3">
        <audio src={url} controls preload="metadata" className="w-full" />
      </div>
    );
  }

  return (
    <AspectRatio ratio={16 / 9} className="bg-muted overflow-hidden rounded-md">
      {item.kind === 'IMAGE' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={item.media?.fileName ?? ''}
          loading="lazy"
          className="size-full object-cover"
        />
      ) : (
        <video src={url} muted preload="metadata" className="size-full object-contain" />
      )}
    </AspectRatio>
  );
}
