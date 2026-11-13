'use client';

import { useRef, useState } from 'react';

import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/utils';

export const DirectionAwareHover = ({
  imageUrl,
  alt,
  onError,
  children,
  childrenClassName,
  imageClassName,
  className,
}: {
  imageUrl: string;
  /** Lo que dice la imagen para un lector de pantalla. */
  alt: string;
  onError?: () => void;
  children: React.ReactNode | string;
  childrenClassName?: string;
  imageClassName?: string;
  className?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);

  const [direction, setDirection] = useState<'top' | 'bottom' | 'left' | 'right' | string>('left');

  const handleMouseEnter = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!ref.current) return;

    const direction = getDirection(event, ref.current);
    switch (direction) {
      case 0:
        setDirection('top');
        break;
      case 1:
        setDirection('right');
        break;
      case 2:
        setDirection('bottom');
        break;
      case 3:
        setDirection('left');
        break;
      default:
        setDirection('left');
        break;
    }
  };

  const getDirection = (ev: React.MouseEvent<HTMLDivElement, MouseEvent>, obj: HTMLElement) => {
    const { width: w, height: h, left, top } = obj.getBoundingClientRect();
    const x = ev.clientX - left - (w / 2) * (w > h ? h / w : 1);
    const y = ev.clientY - top - (h / 2) * (h > w ? w / h : 1);
    const d = Math.round(Math.atan2(y, x) / 1.57079633 + 5) % 4;
    return d;
  };

  return (
    <motion.div
      onMouseEnter={handleMouseEnter}
      ref={ref}
      className={cn('group/card relative overflow-hidden bg-transparent', className)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          className="relative h-full w-full"
          initial="initial"
          whileHover={direction}
          exit="exit"
        >
          <motion.div className="bg-noche/40 absolute inset-0 z-10 hidden h-full w-full transition duration-500 group-hover/card:block" />
          <motion.div
            variants={variants}
            className="bg-muted relative h-full w-full"
            transition={{
              duration: 0.2,
              ease: 'easeOut',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- la URL viene firmada y caduca */}
            <img
              alt={alt}
              loading="lazy"
              onError={onError}
              className={cn('h-full w-full scale-[1.15] object-cover', imageClassName)}
              width="1000"
              height="1000"
              src={imageUrl}
            />
          </motion.div>
          <motion.div
            variants={textVariants}
            transition={{
              duration: 0.5,
              ease: 'easeOut',
            }}
            className={cn('text-noche-tinta absolute bottom-2 left-3 z-40', childrenClassName)}
          >
            {children}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
};

const variants = {
  initial: {
    x: 0,
  },

  exit: {
    x: 0,
    y: 0,
  },
  top: {
    y: 20,
  },
  bottom: {
    y: -20,
  },
  left: {
    x: 20,
  },
  right: {
    x: -20,
  },
};

const textVariants = {
  initial: {
    y: 0,
    x: 0,
    opacity: 0,
  },
  exit: {
    y: 0,
    x: 0,
    opacity: 0,
  },
  top: {
    y: -20,
    opacity: 1,
  },
  bottom: {
    y: 2,
    opacity: 1,
  },
  left: {
    x: -2,
    opacity: 1,
  },
  right: {
    x: 20,
    opacity: 1,
  },
};
