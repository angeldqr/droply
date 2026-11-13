import type { ComponentProps } from 'react';
import { Progress } from '@/components/ui/progress';
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
          ? // En negro el anillo de foco negro no se ve: adentro pasa a menta.
            'bg-primary text-primary-foreground [--ring:var(--color-menta)]'
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

/**
 * Una cifra del panel negro: el rótulo chico, el número y una línea que lo
 * explica. `big` es para la que importa, que va más grande y con el rótulo en
 * menta; debajo puede llevar su barra (`children`).
 */
export function PanelFigure({
  label,
  value,
  hint,
  big = false,
  children,
}: {
  label: string;
  value: string;
  hint: string;
  big?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <dt
        className={cn(
          'font-mono text-xs uppercase tracking-[0.16em]',
          big ? 'text-menta' : 'text-primary-foreground/60',
        )}
      >
        {label}
      </dt>
      <dd className={cn('font-display font-medium tracking-tight', big ? 'text-5xl' : 'text-3xl')}>
        {value}
      </dd>
      <dd className="text-primary-foreground/60 text-sm">{hint}</dd>
      {children}
    </div>
  );
}

/** La barra menta del panel negro: cuánto va de lo que importa. */
export function PanelBar({ value, label }: { value: number; label: string }) {
  return (
    <dd>
      <Progress
        value={Math.min(100, Math.max(0, value))}
        aria-label={label}
        className="bg-primary-foreground/15 [&>[data-slot=progress-indicator]]:bg-menta mt-1 h-2"
      />
    </dd>
  );
}
