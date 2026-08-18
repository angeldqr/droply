'use client';

import {
  COLUMN_LABELS,
  COLUMN_ORDER,
  type ItemKind,
  type LibraryItemView,
} from '@droply/contracts';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AddTextDialog } from '@/components/add-text-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Item, ItemActions, ItemContent, ItemDescription } from '@/components/ui/item';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ApiError } from '@/lib/api';
import { COLUMN_TINT } from '@/lib/columns';
import { useMoveItem, useRemoveItem } from '@/lib/libraries';
import { useMorphDialog } from '@/lib/morph-dialog';

/**
 * El tablero del boceto: cuatro columnas separadas por líneas de tinta, cada
 * una con su pila de elementos y el botón de agregar **al pie**.
 *
 * Que el botón esté abajo y no arriba no es un capricho: es lo que hace que la
 * pila crezca hacia donde está la mano, y que agregar dos cosas seguidas no
 * obligue a volver a subir.
 */
export function LibraryBoard({
  libraryId,
  items,
}: {
  libraryId: string;
  items: readonly LibraryItemView[];
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
  onAddText,
  addButtonProps,
  className,
}: {
  libraryId: string;
  kind: ItemKind;
  items: readonly LibraryItemView[];
  onAddText: () => void;
  addButtonProps: { 'data-blendy-from': string };
  className: string;
}) {
  const isText = kind === 'TEXT';

  return (
    <section
      aria-label={COLUMN_LABELS[kind]}
      className={`border-border flex min-h-[28rem] flex-col ${className}`}
    >
      <h2 className={`border-border border-b px-4 py-4 text-center text-xl ${COLUMN_TINT[kind]}`}>
        {COLUMN_LABELS[kind]}
      </h2>

      <div className="flex flex-1 flex-col gap-2 p-3">
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
        <div className="flex justify-center pt-2">
          {isText ? (
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
            <Tooltip>
              <TooltipTrigger asChild>
                {/*
                  `aria-disabled` en vez de `disabled`: un botón deshabilitado
                  no recibe foco ni dispara eventos, así que ni se puede llegar
                  con el teclado ni aparece el tooltip que explica por qué no
                  se puede usar todavía. Así queda enfocable, anunciado como no
                  disponible, y la explicación es alcanzable.
                */}
                <Button
                  variant="ghost"
                  aria-disabled
                  aria-label={`Agregar a ${COLUMN_LABELS[kind]}, todavía no disponible`}
                  onClick={(event) => event.preventDefault()}
                  className="text-muted-foreground/50 h-16 w-16 cursor-not-allowed"
                >
                  <Plus className="size-8" strokeWidth={1.25} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Los archivos llegan con la subida de media.</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </section>
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
      <ItemContent>
        <ItemDescription className="text-foreground line-clamp-4 whitespace-pre-wrap">
          {item.text}
        </ItemDescription>
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
