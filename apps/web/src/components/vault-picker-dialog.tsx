'use client';

import {
  COLUMN_LABELS,
  VAULT_COPY_MAX,
  type ItemKind,
  type LibraryItemView,
} from '@reconectate/contracts';
import { useState } from 'react';
import { toast } from 'sonner';
import { MorphDialogContent } from '@/components/morph-dialog-content';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import Link from 'next/link';
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
 * **Se eligen varios y entran juntos.** Antes cada tarjeta traía su propio
 * botón «Agregar» que copiaba y cerraba el diálogo, así que traer cinco videos
 * eran cinco vueltas de abrir, buscar y volver a abrir. Ahora la tarjeta es una
 * casilla y el diálogo se cierra una sola vez, al final.
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
  const [chosen, setChosen] = useState<string[]>([]);

  const column = vault.data?.items.filter((item) => item.kind === kind) ?? [];
  const cabenTodos = column.length <= VAULT_COPY_MAX;
  const lleno = chosen.length >= VAULT_COPY_MAX;

  function toggle(itemId: string): void {
    setChosen((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : // El tope es del contrato, así que se respeta acá y no se descubre
          // cuando el servidor devuelve un error sobre algo ya elegido.
          current.length >= VAULT_COPY_MAX
          ? current
          : [...current, itemId],
    );
  }

  /** Cerrar por cualquier vía olvida la selección: no sobrevive a la próxima. */
  function change(next: boolean): void {
    onOpenChange(next);

    if (!next) setChosen([]);
  }

  async function add(): Promise<void> {
    try {
      const copiados = await copy.mutateAsync({ sourceItemIds: chosen });

      toast.success(
        copiados.length === 1
          ? 'Listo, ya está en tu biblioteca.'
          : `Listos, entraron ${copiados.length}.`,
      );
      setChosen([]);
      onPicked();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'No se pudo traer del baúl.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <MorphDialogContent toProps={toProps} className="sm:max-w-3xl">
        <div>
          <DialogHeader>
            <DialogTitle>Traer del baúl</DialogTitle>
            <DialogDescription>
              {COLUMN_LABELS[kind]} que ya tienes guardados. Marca los que quieras y entran todos
              juntos. Se copian, así que el baúl se queda con los suyos.
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
              <>
                {cabenTodos ? null : (
                  <p className="text-muted-foreground mb-3 text-xs">
                    Puedes traer hasta {VAULT_COPY_MAX} de una vez. Si necesitas más, hazlo en dos
                    tandas.
                  </p>
                )}

                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {column.map((item) => (
                    <VaultCard
                      key={item.id}
                      item={item}
                      checked={chosen.includes(item.id)}
                      /* Solo se bloquea lo que no está marcado: al llegar al
                         tope hay que poder seguir desmarcando. */
                      disabled={(lleno && !chosen.includes(item.id)) || copy.isPending}
                      onToggle={() => toggle(item.id)}
                    />
                  ))}
                </ul>
              </>
            )}
          </div>

          {column.length === 0 ? null : (
            <DialogFooter className="sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                disabled={copy.isPending}
                onClick={() =>
                  setChosen(
                    chosen.length > 0
                      ? []
                      : // Cortado por el tope: ofrecer «elegir los sesenta» y
                        // que el servidor los rechace sería prometer de más.
                        column.slice(0, VAULT_COPY_MAX).map((item) => item.id),
                  )
                }
              >
                {chosen.length > 0
                  ? 'Quitar la selección'
                  : `Elegir ${cabenTodos ? `los ${column.length}` : `${VAULT_COPY_MAX}`}`}
              </Button>

              <Button
                type="button"
                disabled={chosen.length === 0 || copy.isPending}
                onClick={() => void add()}
              >
                {copy.isPending ? <Spinner /> : null}
                {chosen.length === 0
                  ? 'Agregar'
                  : chosen.length === 1
                    ? 'Agregar 1'
                    : `Agregar ${chosen.length}`}
              </Button>
            </DialogFooter>
          )}
        </div>
      </MorphDialogContent>
    </Dialog>
  );
}

/**
 * Una tarjeta del selector, que es toda ella la casilla.
 *
 * El `<label>` envuelve la vista previa entera para que el objetivo del clic
 * sea la miniatura y no un cuadradito de doce píxeles: se está eligiendo entre
 * imágenes parecidas, y apuntar a la imagen es lo natural. La casilla se queda
 * a la vista igual, porque un borde de color no dice por sí solo que esto se
 * pueda marcar.
 */
function VaultCard({
  item,
  checked,
  disabled,
  onToggle,
}: {
  item: LibraryItemView;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const nombre = item.media?.fileName ?? item.text ?? '';

  return (
    <li>
      <label
        className={`border-border bg-card flex h-full cursor-pointer flex-col gap-2 rounded-lg border p-2 transition-colors ${
          checked ? 'border-primary bg-accent/40' : 'hover:border-primary/40 hover:bg-accent/20'
        } ${disabled && !checked ? 'pointer-events-none opacity-50' : ''}`}
      >
        <div className="flex items-start gap-2">
          <Checkbox
            checked={checked}
            disabled={disabled}
            onCheckedChange={onToggle}
            aria-label={`Elegir ${nombre}`}
            className="mt-0.5 shrink-0"
          />
          <span className="min-w-0 flex-1 truncate text-xs" title={nombre}>
            {nombre}
          </span>
        </div>

        <Preview item={item} />
      </label>
    </li>
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
      /*
       * El reproductor se saca del `<label>` a efectos del clic: sin esto,
       * darle a reproducir marcaría la tarjeta, y quien quiere oír el audio
       * antes de decidir acabaría eligiéndolo sin querer.
       */
      <div
        className="bg-muted grid place-items-center rounded-md p-3"
        onClick={(event) => event.preventDefault()}
      >
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
