'use client';

import { pageCount } from '@reconectate/contracts';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Anterior y siguiente, con «Página 2 de 5» en el medio.
 *
 * Son botones y no enlaces: la página vive en el estado de la pantalla, no en
 * la dirección. Si la lista cabe en una sola página no se dibuja nada.
 */
export function Pager({
  page,
  pageSize,
  total,
  onPage,
  label,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  /** Qué se está paginando, para el lector de pantalla: «Historial de envíos». */
  label: string;
}) {
  const pages = pageCount(total, pageSize);

  // Si la lista se achicó estando en la última página, esa página ya no existe:
  // se vuelve a la última que sí.
  useEffect(() => {
    if (page > pages) onPage(pages);
  }, [page, pages, onPage]);

  if (pages <= 1) return null;

  return (
    <nav aria-label={label} className="mt-4 flex items-center justify-end gap-2">
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        aria-label="Página anterior"
      >
        <ChevronLeft />
      </Button>
      <span className="text-muted-foreground font-mono text-xs tabular-nums" aria-live="polite">
        Página {page} de {pages}
      </span>
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => onPage(page + 1)}
        disabled={page >= pages}
        aria-label="Página siguiente"
      >
        <ChevronRight />
      </Button>
    </nav>
  );
}
