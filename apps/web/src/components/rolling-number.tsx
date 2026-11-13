'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { EASE_OUT } from '@/lib/motion';

/**
 * Una cifra que rueda al cambiar: la nueva entra desde abajo si subió y desde
 * arriba si bajó, con un desenfoque corto. La primera vez aparece quieta.
 */
export function RollingNumber({ value }: { value: number }) {
  // El valor anterior va en estado y no en un ref: un ref escrito durante el
  // render pierde la dirección con el doble render del modo estricto.
  const [previous, setPrevious] = useState(value);
  const [up, setUp] = useState(true);

  if (value !== previous) {
    setUp(value > previous);
    setPrevious(value);
  }

  return (
    // `inline-grid` con una sola celda: la que entra y la que sale se pisan en vez de empujarse.
    <span className="inline-grid overflow-hidden align-bottom">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          className="col-start-1 row-start-1"
          initial={{ y: up ? '100%' : '-100%', opacity: 0, filter: 'blur(4px)' }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: up ? '-100%' : '100%', opacity: 0, filter: 'blur(4px)' }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
