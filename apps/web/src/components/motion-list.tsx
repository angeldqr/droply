'use client';

import { AnimatePresence, motion } from 'motion/react';
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';

/** Salida firme: arranca rápido y frena al final, que es lo que se siente como respuesta. */
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** Si la lista acaba de aparecer: solo entonces las tarjetas entran escalonadas. */
const FirstRender = createContext(false);

/**
 * Una lista cuyas filas entran y salen con movimiento en vez de saltar.
 *
 * Al cargar, las tarjetas aparecen una detrás de otra; al borrar una, se va
 * encogiéndose y las demás cierran el hueco deslizándose, en vez de que todo se
 * reacomode de golpe. Con «reducir movimiento» `MotionConfig` deja solo los
 * fundidos.
 */
export function MotionList({
  as = 'div',
  className,
  children,
}: {
  as?: 'div' | 'ul';
  className?: string;
  children: ReactNode;
}) {
  const first = useRef(true);

  useEffect(() => {
    first.current = false;
  }, []);

  const Tag = as;

  return (
    <Tag className={className}>
      <FirstRender.Provider value={first.current}>
        <AnimatePresence>{children}</AnimatePresence>
      </FirstRender.Provider>
    </Tag>
  );
}

/** Una fila de `MotionList`. Lleva la `key` quien la usa, como cualquier elemento de lista. */
export function MotionItem({
  as = 'div',
  index = 0,
  className,
  children,
}: {
  as?: 'div' | 'li';
  /** Su lugar en la lista: fija el escalonado de la primera carga. */
  index?: number;
  className?: string;
  children: ReactNode;
}) {
  const first = useContext(FirstRender);
  const Component = as === 'li' ? motion.li : motion.div;

  return (
    <Component
      layout
      className={className}
      initial={{ opacity: 0, y: 4 }}
      animate={{
        opacity: 1,
        y: 0,
        // Escalonado corto y con tope: con veinte tarjetas, la última no espera un segundo.
        transition: { duration: 0.2, ease: EASE_OUT, delay: first ? Math.min(index, 8) * 0.04 : 0 },
      }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15, ease: EASE_OUT } }}
      transition={{ layout: { type: 'spring', duration: 0.3, bounce: 0 } }}
    >
      {children}
    </Component>
  );
}
