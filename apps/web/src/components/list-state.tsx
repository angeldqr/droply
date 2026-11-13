import type { ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Lo que este componente necesita de una consulta de TanStack Query. */
interface QueryLike<T> {
  readonly isPending: boolean;
  readonly error: Error | null;
  readonly data: T | undefined;
}

/**
 * Los cuatro estados de una lista: cargando, error, vacía y con datos.
 *
 * Cada pantalla repetía el mismo ternario con sus propias alturas y bordes.
 * Acá va una sola vez: la pantalla dice cómo se ve mientras carga, qué no se
 * pudo traer y qué mostrar cuando no hay nada, y dibuja la lista.
 */
export function ListState<T>({
  query,
  skeleton,
  errorTitle,
  empty,
  children,
}: {
  query: QueryLike<T>;
  skeleton: ReactNode;
  /** Nombra la lista: «No pudimos traer tus bibliotecas». */
  errorTitle: string;
  /** Sin esto, una lista vacía se dibuja como cualquier otra. */
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <>{skeleton}</>;

  if (query.error || query.data === undefined) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{errorTitle}</AlertTitle>
        {query.error ? <AlertDescription>{query.error.message}</AlertDescription> : null}
      </Alert>
    );
  }

  if (empty !== undefined && Array.isArray(query.data) && query.data.length === 0) {
    return <>{empty}</>;
  }

  return <>{children(query.data)}</>;
}

/** Los bloques grises de una lista que todavía no llegó. */
export function SkeletonList({
  count = 3,
  className,
  itemClassName,
}: {
  count?: number;
  /** La misma grilla que tendrá la lista, para que nada salte al llegar. */
  className?: string;
  itemClassName: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className={cn('rounded-4xl w-full', itemClassName)} />
      ))}
    </div>
  );
}

/**
 * El estado vacío: un icono grande, una línea que dice qué va acá y, como hijo,
 * el botón para crear el primero. Sin caja: ya vive dentro de un panel o de la página.
 */
export function EmptyState({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <Empty className="py-16 [&_[data-slot=empty-icon]]:size-14 [&_[data-slot=empty-icon]_svg]:size-7">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {children}
    </Empty>
  );
}
