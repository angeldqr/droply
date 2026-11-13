'use client';

import React, { useState, useRef } from 'react';
import {
  motion,
  useTransform,
  AnimatePresence,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'motion/react';

export const AnimatedTooltip = ({
  items,
}: {
  items: {
    id: string;
    name: string;
    designation: string;
    /** Sin imagen, el círculo lleva las iniciales del nombre. */
    image?: string;
  }[];
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<string | null>(null);
  const springConfig = { stiffness: 100, damping: 15 };
  const x = useMotionValue(0);
  const animationFrameRef = useRef<number | null>(null);
  const still = useReducedMotion();

  const rotate = useSpring(useTransform(x, [-100, 100], [-45, 45]), springConfig);
  const translateX = useSpring(useTransform(x, [-100, 100], [-50, 50]), springConfig);

  const handleMouseMove = (event: React.MouseEvent<HTMLElement>) => {
    // El globo se mece tras el cursor con un resorte, que la opción global no apaga.
    if (still) return;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Se leen acá: dentro del cuadro de animación el evento ya no tiene destino.
    const halfWidth = event.currentTarget.offsetWidth / 2;
    const offsetX = event.nativeEvent.offsetX;

    animationFrameRef.current = requestAnimationFrame(() => {
      x.set(offsetX - halfWidth);
    });
  };

  return (
    <>
      {items.map((item) => (
        // Con el teclado se llega igual que con el ratón, y se ve lo mismo.
        <div
          className="focus-visible:outline-ring group relative -mr-2 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2"
          key={item.id}
          tabIndex={0}
          role="img"
          aria-label={`${item.name}: ${item.designation}`}
          onMouseEnter={() => setHoveredIndex(item.id)}
          onMouseLeave={() => setHoveredIndex(null)}
          onFocus={() => setHoveredIndex(item.id)}
          onBlur={() => setHoveredIndex(null)}
        >
          <AnimatePresence>
            {hoveredIndex === item.id && (
              <motion.div
                aria-hidden
                initial={{ opacity: 0, y: -20, scale: 0.6 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: {
                    type: 'spring',
                    stiffness: 260,
                    damping: 10,
                  },
                }}
                exit={{ opacity: 0, y: -20, scale: 0.6 }}
                style={{
                  translateX: translateX,
                  rotate: rotate,
                  whiteSpace: 'nowrap',
                }}
                className="border-border bg-popover absolute left-1/2 top-full z-50 mt-3 flex -translate-x-1/2 flex-col items-center justify-center rounded-xl border px-4 py-2 text-xs shadow-xl"
              >
                <div className="via-menta absolute inset-x-10 -bottom-px z-30 h-px w-[20%] bg-gradient-to-r from-transparent to-transparent" />
                <div className="via-aguamarina absolute -bottom-px left-10 z-30 h-px w-[40%] bg-gradient-to-r from-transparent to-transparent" />
                <div className="text-popover-foreground relative z-30 text-base font-bold">
                  {item.name}
                </div>
                <div className="text-muted-foreground text-xs">{item.designation}</div>
              </motion.div>
            )}
          </AnimatePresence>
          {item.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- la imagen viene firmada de otro origen
            <img
              onMouseMove={handleMouseMove}
              height={100}
              width={100}
              src={item.image}
              alt=""
              className="border-background relative !m-0 size-10 rounded-full border-2 object-cover object-top !p-0 transition duration-500 group-hover:z-30 group-hover:scale-105"
            />
          ) : (
            <span
              onMouseMove={handleMouseMove}
              aria-hidden
              className="border-background bg-muted text-foreground relative grid size-10 place-items-center rounded-full border-2 text-xs font-medium transition duration-500 group-hover:z-30 group-hover:scale-105"
            >
              {item.name
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part.charAt(0).toUpperCase())
                .join('')}
            </span>
          )}
        </div>
      ))}
    </>
  );
};
