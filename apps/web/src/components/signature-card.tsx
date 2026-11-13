'use client';

import { useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { NoiseBackground } from '@/components/ui/noise-background';
import { cn } from '@/lib/utils';

/** Las manchas que se mueven sobre la menta: aguamarina, casi blanco y celeste. */
const BLOBS = ['var(--color-aguamarina)', 'var(--color-menta-clara)', 'var(--color-celeste)'];

/**
 * La tarjeta firma: menta con un degradado que se mueve despacio y grano encima.
 *
 * Es el asistente, que está en todas las pantallas. No se repite en otras
 * tarjetas: si aparece dos veces deja de señalar nada. Lo de adentro va siempre
 * en negro.
 */
export function SignatureCard({
  className,
  containerClassName,
  children,
}: {
  /** Para lo de adentro. */
  className?: string;
  /** Para la caja: tamaño y radio. */
  containerClassName?: string;
  children: ReactNode;
}) {
  // El degradado se mueve por JavaScript, así que la regla de CSS no lo alcanza.
  const still = useReducedMotion();

  return (
    <NoiseBackground
      containerClassName={cn(
        'bg-menta rounded-4xl p-0 shadow-none dark:shadow-none',
        containerClassName,
      )}
      className={cn('text-sobre-menta p-6 md:p-8', className)}
      gradientColors={BLOBS}
      noiseIntensity={0.35}
      speed={0.06}
      backdropBlur={false}
      animating={!still}
    >
      {children}
    </NoiseBackground>
  );
}
