'use client';

import {
  COLUMN_LABELS,
  COLUMN_ORDER,
  MEDIA_LIMITS,
  requestUploadSchema,
  type ItemKind,
  type LibraryItemView,
  type MediaView,
  type UploadableKind,
} from '@droply/contracts';
import { Archive, ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import { AddTextDialog } from '@/components/add-text-dialog';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { VaultPickerDialog } from '@/components/vault-picker-dialog';
import { ApiError } from '@/lib/api';
import { COLUMN_TINT } from '@/lib/columns';
import { useMoveItem, useRemoveItem, useUploadMedia } from '@/lib/libraries';
import { useMorphDialog } from '@/lib/morph-dialog';

/**
 * El tablero del boceto: cuatro columnas separadas por líneas de tinta, cada
 * una con su pila de elementos y el botón de agregar **al pie**.
 *
 * Que el botón esté abajo y no arriba no es un capricho: es lo que hace que la
 * pila crezca hacia donde está la mano, y que agregar dos cosas seguidas no
 * obligue a volver a subir.
 *
 * El mismo tablero sirve para el baúl. Lo único que cambia ahí es que no se
 * ofrece traer del baúl, que sería traerse cosas de sí mismo.
 */
export function LibraryBoard({
  libraryId,
  items,
  isVault = false,
}: {
  libraryId: string;
  items: readonly LibraryItemView[];
  isVault?: boolean;
}) {
  const dialog = useMorphDialog('agregar-texto');

  return (
    <>
      <div className="border-border grid grid-cols-1 border sm:grid-cols-2 lg:grid-cols-4">
        {COLUMN_ORDER.map((kind, index) => (
          <Column
            key={kind}
            libraryId={libraryId}
            kind={kind}
            items={items.filter((item) => item.kind === kind)}
            isVault={isVault}
            onAddText={dialog.openDialog}
            addButtonProps={dialog.fromProps}
            className={COLUMN_BORDERS[index] ?? ''}
          />
        ))}
      </div>

      <AddTextDialog
        libraryId={libraryId}
        open={dialog.open}
        onOpenChange={dialog.onOpenChange}
        toProps={dialog.toProps}
      />
    </>
  );
}

/*
 * Los bordes internos van por posición y no con una sola clase para todas.
 *
 * La rejilla cambia de una columna a dos y a cuatro según el ancho, así que
 * cuál de ellas empieza una fila —y por lo tanto no lleva línea a la
 * izquierda— depende del breakpoint. Con una clase única, la primera columna
 * dibujaba su borde encima del borde del contenedor y quedaba una línea el
 * doble de gruesa.
 */
/** Qué decir cuando una columna está vacía. Una invitación, no un lamento. */
const EMPTY_COLUMN: Readonly<Record<ItemKind, string>> = {
  AUDIO: 'Sube una canción, una nota de voz, lo que quieras que suene.',
  VIDEO: 'Sube un video para que llegue tal cual.',
  IMAGE: 'Sube una foto y aparecerá acá con su vista previa.',
  TEXT: 'Escribe un mensaje o trae un archivo de texto.',
};

const COLUMN_BORDERS = [
  '',
  'border-t sm:border-t-0 sm:border-l',
  'border-t lg:border-t-0 lg:border-l',
  'border-t sm:border-l lg:border-t-0',
] as const;

function Column({
  libraryId,
  kind,
  items,
  isVault,
  onAddText,
  addButtonProps,
  className,
}: {
  libraryId: string;
  kind: ItemKind;
  items: readonly LibraryItemView[];
  isVault: boolean;
  onAddText: () => void;
  addButtonProps: { 'data-blendy-from': string };
  className: string;
}) {
  const picker = useMorphDialog(`baul-${kind.toLowerCase()}`);

  return (
    <section
      aria-label={COLUMN_LABELS[kind]}
      className={`border-border flex min-h-[28rem] flex-col ${className}`}
    >
      {/* La cuenta vive en el encabezado y no en una etiqueta aparte: es el
          dato que se busca al mirar una columna, y ahí no ocupa nada. */}
      <h2
        className={`border-border flex items-center justify-center gap-2 border-b px-4 py-4 text-xl ${COLUMN_TINT[kind]}`}
      >
        {COLUMN_LABELS[kind]}
        {items.length > 0 ? (
          <span className="bg-background/50 rounded-full px-2 py-0.5 text-sm tabular-nums">
            {items.length}
          </span>
        ) : null}
      </h2>

      <div className="flex flex-1 flex-col gap-2 p-3">
        {items.length === 0 ? (
          <p className="text-muted-foreground px-2 pt-6 text-center text-sm">
            {EMPTY_COLUMN[kind]}
          </p>
        ) : null}

        {items.map((item, index) => (
          <StackedItem
            key={item.id}
            libraryId={libraryId}
            item={item}
            previousId={items[index - 1]?.id}
            nextId={items[index + 1]?.id}
          />
        ))}

        {/*
          El botón queda al final de la pila y baja solo a medida que se agregan
          elementos, que es exactamente el gesto del boceto.
        */}
        <div className="flex flex-col items-center gap-2 pt-2">
          {kind === 'TEXT' ? (
            <Button
              variant="ghost"
              onClick={onAddText}
              aria-label={`Agregar a ${COLUMN_LABELS[kind]}`}
              className="text-muted-foreground hover:text-foreground h-16 w-16"
              {...addButtonProps}
            >
              {/* Blendy necesita que el contenido cuelgue de un solo elemento. */}
              <span className="flex items-center justify-center">
                <Plus className="size-8" strokeWidth={1.25} />
              </span>
            </Button>
          ) : (
            <UploadButton libraryId={libraryId} kind={kind} />
          )}

          {isVault ? null : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={picker.openDialog}
                className="text-muted-foreground hover:text-foreground"
                {...picker.fromProps}
              >
                {/* Blendy necesita que el contenido cuelgue de un solo elemento. */}
                <span className="flex items-center gap-2">
                  <Archive className="size-4" /> Del baúl
                </span>
              </Button>

              <VaultPickerDialog
                libraryId={libraryId}
                kind={kind}
                open={picker.open}
                onOpenChange={picker.onOpenChange}
                onPicked={picker.close}
                toProps={picker.toProps}
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * El botón de agregar de las tres columnas de archivos.
 *
 * Un `<input type="file">` no se puede maquillar sin pelear con el navegador,
 * así que va escondido y lo dispara el botón. El `accept` sale de los mismos
 * techos que valida el servidor, así el diálogo del sistema ya filtra lo que no
 * sirve en vez de dejar elegir algo que después se rechaza.
 */
function UploadButton({ libraryId, kind }: { libraryId: string; kind: UploadableKind }) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const upload = useUploadMedia(libraryId);

  const limits = MEDIA_LIMITS[kind];
  const uploading = progress !== null;

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    // Se limpia enseguida para que elegir el mismo archivo otra vez, después de
    // un error, vuelva a disparar el evento.
    event.target.value = '';

    if (!file) return;

    // El mismo esquema que valida el servidor, corrido acá para avisar en el
    // acto. Repetir las comprobaciones a mano sería tener dos versiones del
    // mismo mensaje esperando a separarse.
    const check = requestUploadSchema.safeParse({
      kind,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    });

    if (!check.success) {
      toast.error(check.error.issues[0]?.message ?? 'Ese archivo no sirve para esta columna.');
      return;
    }

    setProgress(0);

    try {
      await upload.mutateAsync({ kind, file, onProgress: setProgress });
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'No se pudo subir el archivo.');
    } finally {
      setProgress(null);
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept={limits.mimeTypes.join(',')}
        onChange={onPick}
        className="hidden"
      />

      <Button
        variant="ghost"
        onClick={() => input.current?.click()}
        disabled={uploading}
        aria-label={`Agregar a ${COLUMN_LABELS[kind]}`}
        className="text-muted-foreground hover:text-foreground h-16 w-16"
      >
        {uploading ? <Spinner /> : <Plus className="size-8" strokeWidth={1.25} />}
      </Button>

      {uploading ? (
        <Progress
          value={Math.round(progress * 100)}
          aria-label={`Subiendo a ${COLUMN_LABELS[kind]}`}
          className="w-full"
        />
      ) : null}
    </>
  );
}

function StackedItem({
  libraryId,
  item,
  previousId,
  nextId,
}: {
  libraryId: string;
  item: LibraryItemView;
  previousId: string | undefined;
  nextId: string | undefined;
}) {
  const move = useMoveItem(libraryId);
  const remove = useRemoveItem(libraryId);

  const reorder = (target: {
    afterItemId?: string | undefined;
    beforeItemId?: string | undefined;
  }) => {
    move.mutate(
      { itemId: item.id, ...target },
      {
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.message : 'No se pudo mover.'),
      },
    );
  };

  return (
    <Item variant="outline" size="sm" className="bg-card items-start">
      {/*
        `min-w-0` porque esto es un hijo de flex, y sin eso no puede encogerse
        por debajo de su contenido: un nombre de archivo largo ensancha la
        tarjeta entera en vez de recortarse.
      */}
      <ItemContent className="min-w-0">
        {item.media ? (
          <MediaContent kind={item.kind} media={item.media} />
        ) : (
          <ItemDescription className="text-foreground line-clamp-4 whitespace-pre-wrap break-words">
            {item.text}
          </ItemDescription>
        )}
      </ItemContent>

      <ItemActions>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" aria-label="Opciones">
              <span aria-hidden>···</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              disabled={!previousId}
              onSelect={() => reorder({ beforeItemId: previousId })}
            >
              <ArrowUp /> Subir
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!nextId} onSelect={() => reorder({ afterItemId: nextId })}>
              <ArrowDown /> Bajar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() =>
                remove.mutate(item.id, {
                  onError: (error) =>
                    toast.error(error instanceof ApiError ? error.message : 'No se pudo quitar.'),
                })
              }
            >
              <Trash2 /> Quitar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ItemActions>
    </Item>
  );
}

/**
 * El archivo dentro de su tarjeta.
 *
 * Sin URL el archivo no terminó de subir: quedó a medias porque se cortó la
 * conexión o se cerró la pestaña. La tarjeta lo dice en vez de esconderlo, y el
 * menú de siempre sirve para quitarla.
 */
function MediaContent({ kind, media }: { kind: ItemKind; media: MediaView }) {
  /*
   * La URL viene firmada y caduca. Si el almacenamiento no está levantado, o si
   * la pestaña llevaba abierta más tiempo que la firma, el reproductor se queda
   * en negro sin decir por qué. `onError` lo cuenta y pide recargar, que es lo
   * que vuelve a firmar.
   */
  const [failed, setFailed] = useState(false);

  if (media.url === null) {
    return (
      <>
        <FileName media={media} />
        <ItemDescription>Se quedó a medias. Quítalo y vuelve a subirlo.</ItemDescription>
      </>
    );
  }

  if (failed) {
    return (
      <>
        <FileName media={media} />
        <ItemDescription>No se pudo cargar el archivo. Recarga la página.</ItemDescription>
      </>
    );
  }

  return (
    <>
      <FileName media={media} />

      {kind === 'AUDIO' ? (
        <audio
          src={media.url}
          controls
          preload="metadata"
          onError={() => setFailed(true)}
          className="w-full"
        />
      ) : (
        <Dialog>
          {/*
            La tarjeta recorta para que la columna no se descuadre, así que en
            ella no se ve la foto entera. Un clic la abre completa: es el gesto
            que ya se espera de una miniatura, y evita tener que bajar el
            archivo para saber qué hay dentro.
          */}
          <DialogTrigger asChild>
            <button
              type="button"
              aria-label={`Ver ${media.fileName}`}
              className="focus-visible:outline-ring block w-full cursor-zoom-in rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {/* La caja se reserva antes de que llegue el archivo, así la
                  tarjeta no pega un salto ni empuja a las de abajo. */}
              <AspectRatio ratio={16 / 9} className="bg-muted overflow-hidden rounded-sm">
                {kind === 'IMAGE' ? (
                  /*
                   * `<img>` a propósito, no `next/image`. El optimizador
                   * descarga la imagen desde el servidor y deja el resultado en
                   * su caché de disco, donde sobreviviría a la firma que la
                   * protege: el bucket es privado y la URL caduca justamente
                   * para que el archivo no quede accesible.
                   *
                   * ponytail: se muestra el original encogido y no una
                   * miniatura de verdad; generarlas pide un worker con sharp, y
                   * hasta que una biblioteca grande se sienta lenta no compensa.
                   */
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={media.url}
                    alt={media.fileName}
                    loading="lazy"
                    onError={() => setFailed(true)}
                    className="size-full object-cover"
                  />
                ) : (
                  /*
                   * Sin controles y silenciado en la tarjeta: acá solo hace
                   * falta el primer fotograma para reconocerlo, y `metadata` en
                   * vez de `auto` para que una columna con diez videos no baje
                   * medio giga antes de que nadie le dé al play.
                   */
                  <video
                    src={media.url}
                    muted
                    preload="metadata"
                    onError={() => setFailed(true)}
                    className="size-full object-contain"
                  />
                )}
              </AspectRatio>
            </button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-4xl">
            <DialogTitle className="truncate pr-8">{media.fileName}</DialogTitle>

            {kind === 'IMAGE' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={media.url}
                alt={media.fileName}
                className="max-h-[70vh] w-full rounded-md object-contain"
              />
            ) : (
              <video
                src={media.url}
                controls
                autoPlay
                className="max-h-[70vh] w-full rounded-md object-contain"
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function FileName({ media }: { media: MediaView }) {
  return (
    <ItemTitle className="w-full truncate" title={media.fileName}>
      {media.fileName}
    </ItemTitle>
  );
}
