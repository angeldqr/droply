import { RollingNumber } from '@/components/rolling-number';
import { cn } from '@/lib/utils';

/** Una columna por cifra en pantallas anchas: con tres no queda una cuarta vacía. */
const COLUMNS: Readonly<Record<number, string>> = {
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
};

export interface Stat {
  readonly label: string;
  readonly value: number;
  /** La cifra que importa de la fila, en el verde de lo cumplido. */
  readonly accent?: boolean;
}

/**
 * La fila de cifras que va arriba de una lista: cuánto hay, de un vistazo.
 *
 * Son cifras de lo que ya llegó a la pantalla, no una consulta aparte.
 */
export function StatRow({ stats, className }: { stats: readonly Stat[]; className?: string }) {
  return (
    <dl
      className={cn('grid grid-cols-2 gap-2', COLUMNS[stats.length] ?? 'lg:grid-cols-4', className)}
    >
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="border-border bg-card flex flex-col gap-1 rounded-3xl border px-5 py-4"
        >
          <dt className={cn('text-sm', stat.accent ? 'text-logro' : 'text-muted-foreground')}>
            {stat.label}
          </dt>
          <dd className="font-mono text-2xl font-medium tabular-nums">
            <RollingNumber value={stat.value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
