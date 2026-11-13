import { useId } from 'react';

import { cn } from '@/lib/utils';

/**
 * El logo: un despertador con las agujas a las diez y diez, que juntas dibujan
 * un visto. Es la hora que uno elige y el hábito cumplido. Va en su cuadro de
 * app, con el volumen de los íconos de Stepbro: sombra que cae, brillo arriba y
 * sombra adentro abajo. `animated` hace que las agujas giren hasta el visto al
 * aparecer.
 *
 * El mismo dibujo, quieto, está en `app/icon.svg` (la pestaña) y en
 * `app/apple-icon.png` (el celular, en cuadrado lleno): un cambio acá va también allá.
 */
export function BrandMark({
  className,
  animated = false,
}: {
  className?: string;
  animated?: boolean;
}) {
  // Los degradados y el filtro se nombran por instancia: hay más de un logo por página.
  const id = useId().replace(/[^\w-]/g, '');
  const tile = `${id}-tile`;
  const body = `${id}-body`;
  const gloss = `${id}-gloss`;

  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden
      className={cn('shrink-0', animated && 'brand-mark-animated', className)}
    >
      <defs>
        <linearGradient id={tile} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#173a26" />
          <stop offset="1" stopColor="#050b07" />
        </linearGradient>
        <linearGradient id={body} x1="0" y1="0" x2=".35" y2="1">
          <stop offset="0" stopColor="#8dffc0" />
          <stop offset=".55" stopColor="#3df58a" />
          <stop offset="1" stopColor="#1fc767" />
        </linearGradient>
        <filter id={gloss} x="-25%" y="-25%" width="150%" height="160%">
          <feOffset in="SourceAlpha" dy="-3.2" result="up" />
          <feGaussianBlur in="up" stdDeviation="2.2" result="upBlur" />
          <feComposite in="SourceAlpha" in2="upBlur" operator="out" result="low" />
          <feFlood floodColor="#000" floodOpacity=".22" />
          <feComposite in2="low" operator="in" result="shade" />
          <feOffset in="SourceAlpha" dy="2.2" result="down" />
          <feGaussianBlur in="down" stdDeviation="1.3" result="downBlur" />
          <feComposite in="SourceAlpha" in2="downBlur" operator="out" result="top" />
          <feFlood floodColor="#fff" floodOpacity=".5" />
          <feComposite in2="top" operator="in" result="shine" />
          <feGaussianBlur in="SourceAlpha" stdDeviation="3.2" result="dropBlur" />
          <feOffset in="dropBlur" dy="3.5" result="dropOffset" />
          <feFlood floodColor="#000" floodOpacity=".4" />
          <feComposite in2="dropOffset" operator="in" result="drop" />
          <feMerge>
            <feMergeNode in="drop" />
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="shade" />
            <feMergeNode in="shine" />
          </feMerge>
        </filter>
      </defs>

      <rect width="100" height="100" rx="23" fill={`url(#${tile})`} />
      <g filter={`url(#${gloss})`}>
        <circle cx="29" cy="30" r="10" fill={`url(#${body})`} />
        <circle cx="71" cy="30" r="10" fill={`url(#${body})`} />
        <path
          d="M34 79 28 87M66 79 72 87"
          fill="none"
          stroke={`url(#${body})`}
          strokeWidth="5.5"
          strokeLinecap="round"
        />
        {/* La ranura que separa las campanas de la esfera. */}
        <circle cx="50" cy="56" r="29.5" fill="#0c1d14" />
        <circle cx="50" cy="56" r="27" fill={`url(#${body})`} />
      </g>
      <g stroke="#0c1d14" strokeWidth="5" strokeLinecap="round">
        <path className="brand-mark-hour" d="M50 56 40 49.5" />
        <path className="brand-mark-minute" d="M50 56 62.5 43.5" />
      </g>
      <circle cx="50" cy="56" r="3.6" fill="#0c1d14" />
      <rect
        x=".5"
        y=".5"
        width="99"
        height="99"
        rx="22.5"
        fill="none"
        stroke="#fff"
        strokeOpacity=".07"
      />
    </svg>
  );
}
