import { Button } from '@/components/ui/button';

/** El botón de «Ver más» de una lista que se muestra por partes. No se dibuja si ya está toda. */
export function ShowMore({
  remaining,
  size,
  onMore,
  className,
}: {
  remaining: number;
  /** De a cuántos se agregan. */
  size: number;
  onMore: () => void;
  className?: string;
}) {
  if (remaining <= 0) return null;

  return (
    <Button variant="outline" onClick={onMore} {...(className ? { className } : {})}>
      Ver {Math.min(size, remaining)} más
      <span className="text-muted-foreground font-mono text-xs tabular-nums">
        quedan {remaining}
      </span>
    </Button>
  );
}
