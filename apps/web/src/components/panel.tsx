import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * Un panel del bento: la caja en la que vive cada bloque de una pantalla.
 *
 * Los paneles van pegados (`gap-2` en quien los agrupa) y solo con un borde
 * fino. `filled` es para **uno** por pantalla: el que dice lo importante.
 */
export function Panel({
  filled = false,
  className,
  ...props
}: ComponentProps<'section'> & { filled?: boolean }) {
  return (
    <section
      className={cn(
        'rounded-4xl flex min-w-0 flex-col p-6',
        filled
          ? 'bg-primary text-primary-foreground'
          : 'border-border bg-card text-card-foreground border',
        className,
      )}
      {...props}
    />
  );
}

/**
 * El rótulo de un panel: qué hay adentro, y a la derecha lo que se puede hacer
 * con eso. `description` dice en una línea qué es lo que se está mirando: un
 * título solo («Avisos») no alcanza para quien llega por primera vez.
 */
export function PanelHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <h2 className="text-xl">{title}</h2>
        {description ? (
          <p className="text-muted-foreground mt-1.5 text-sm leading-snug">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}
