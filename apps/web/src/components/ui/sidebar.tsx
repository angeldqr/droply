'use client';
import { cn } from '@/lib/utils';
import React, { useRef, useState, createContext, useContext, useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { IconMenu2, IconX } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';

interface Links {
  label: string;
  href: string;
  icon: React.JSX.Element | React.ReactNode;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
  /** En escritorio, el panel se queda abierto aunque el ratón se vaya. */
  pinned: boolean;
  setPinned: (pinned: boolean) => void;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

/*
 * Si el panel va fijo, recordado en este navegador. Por defecto sí: es lo que
 * se pidió, que el menú esté siempre a la vista y se pueda recoger.
 *
 * Va por `useSyncExternalStore` porque cada pantalla monta su propio armazón:
 * leerlo en un efecto lo haría abrirse y recogerse en cada cambio de página.
 * Si el navegador no deja guardar, se recuerda mientras la pestaña siga abierta.
 */
const PINNED_KEY = 'reconectate:menu-fijo';
const pinnedListeners = new Set<() => void>();
let pinnedInMemory: boolean | null = null;

function readPinned(): boolean {
  if (pinnedInMemory !== null) return pinnedInMemory;

  try {
    return localStorage.getItem(PINNED_KEY) !== 'no';
  } catch {
    return true;
  }
}

function storePinned(pinned: boolean): void {
  pinnedInMemory = pinned;

  try {
    localStorage.setItem(PINNED_KEY, pinned ? 'si' : 'no');
  } catch {
    // Sin almacenamiento queda en memoria; no hay nada más que hacer.
  }

  pinnedListeners.forEach((listener) => listener());
}

function subscribePinned(listener: () => void): () => void {
  pinnedListeners.add(listener);

  return () => pinnedListeners.delete(listener);
}

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(false);

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;
  const pinned = useSyncExternalStore(subscribePinned, readPinned, () => true);

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate, pinned, setPinned: storePinned }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = ({
  brand,
  ...props
}: React.ComponentProps<typeof motion.div> & {
  /** Lo que se ve en la barra de arriba del teléfono, a la izquierda del menú. */
  brand?: React.ReactNode;
}) => {
  return (
    <>
      <DesktopSidebar {...props} />
      <MobileSidebar brand={brand} {...(props as React.ComponentProps<'div'>)} />
    </>
  );
};

/** Cuánto tiene que quedarse el ratón encima antes de abrir: pasar de largo no abre. */
const HOVER_DELAY_MS = 150;

/**
 * El panel de escritorio.
 *
 * **Fijo** (lo normal): mide 300 px dentro de la página, empuja el contenido y
 * no se cierra al quitar el ratón.
 *
 * **Recogido**: ocupa un carril de 60 px, y al pasar el ratón se dibuja
 * **encima** del contenido en vez de ensancharse dentro de la página, que
 * movería la pantalla entera en cada paso del ratón. Se abre también con el
 * foco del teclado, que sin esto recorría iconos sin nombre.
 */
export const DesktopSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) => {
  const context = useSidebar();
  const { open, setOpen, animate, pinned } = context;
  const expanded = pinned || open;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function openSoon(): void {
    if (pinned) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), HOVER_DELAY_MS);
  }

  function close(): void {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  }

  /*
   * El foco solo abre si es del teclado (`:focus-visible`). Un clic también
   * enfoca, y el menú de la cuenta devuelve el foco a su botón al cerrarse: con
   * cualquier foco el panel se abría sin esperar al hover o se quedaba abierto
   * con el ratón ya afuera.
   */
  const keyboardFocusIn = (panel: HTMLElement) => panel.querySelector(':focus-visible') !== null;

  return (
    // `z-40` en el carril y no solo en el panel: `sticky` arma su propio contexto de
    // apilado, y sin esto las tarjetas y el encabezado quedaban por encima.
    <motion.div
      initial={false}
      animate={{ width: pinned ? 300 : 60 }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      className="relative z-40 hidden shrink-0 md:sticky md:top-0 md:block md:h-dvh"
    >
      <motion.div
        initial={false}
        className={cn(
          'absolute inset-y-0 left-0 z-40 flex h-full w-[300px] flex-col overflow-hidden px-4 py-4',
          open && !pinned && 'shadow-ciruela-900/30 shadow-2xl',
          className,
        )}
        animate={{ width: animate ? (expanded ? '300px' : '60px') : '300px' }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
        onMouseEnter={openSoon}
        onMouseLeave={(event) => {
          // Quien recorre el menú con el teclado no lo pierde porque el ratón se mueva.
          if (!keyboardFocusIn(event.currentTarget)) close();
        }}
        onFocus={(event) => {
          if (!pinned && (event.target as HTMLElement).matches(':focus-visible')) setOpen(true);
        }}
        onBlur={(event) => {
          const next = event.relatedTarget as HTMLElement | null;

          // Solo al salir del panel entero. El menú de la cuenta vive en un
          // portal: sus opciones no están dentro del panel pero son parte de él.
          if (event.currentTarget.contains(next) || next?.closest('[role="menu"]')) return;

          close();
        }}
        {...props}
      >
        {/*
          Lo de adentro (rótulos, nombres) mira `open` para mostrarse. Aquí
          «abierto» es también estar fijo; el cajón del teléfono sigue con el
          suyo, que si no se abriría solo.
        */}
        <SidebarContext.Provider value={{ ...context, open: expanded }}>
          {/* `motion.div` admite valores animados como hijos; aquí siempre son nodos. */}
          {children as React.ReactNode}
        </SidebarContext.Provider>
      </motion.div>
    </motion.div>
  );
};

/**
 * El menú del teléfono: una barra arriba con la marca y un botón que abre el
 * cajón. Los dos botones son botones de verdad, con nombre, para que se puedan
 * usar con el teclado y con un lector de pantalla.
 */
export const MobileSidebar = ({
  className,
  children,
  brand,
  ...props
}: React.ComponentProps<'div'> & { brand?: React.ReactNode }) => {
  const { open, setOpen } = useSidebar();
  return (
    <>
      <div
        className="bg-sidebar text-sidebar-foreground flex h-14 w-full flex-row items-center justify-between px-4 md:hidden"
        {...props}
      >
        <div className="flex min-w-0 items-center">{brand}</div>
        <Button
          variant="ghost"
          size="icon"
          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground size-10"
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          aria-expanded={open}
        >
          <IconMenu2 className="size-5" />
        </Button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ x: '-100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-100%', opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className={cn(
                'fixed inset-0 z-[100] flex h-full w-full flex-col justify-between p-10',
                className,
              )}
            >
              <Button
                variant="ghost"
                size="icon"
                className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground absolute right-6 top-6 z-50 size-10"
                onClick={() => setOpen(false)}
                aria-label="Cerrar menú"
              >
                <IconX className="size-5" />
              </Button>
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export const SidebarLink = ({ link, className, ...props }: { link: Links; className?: string }) => {
  const { open, animate } = useSidebar();
  return (
    <a
      href={link.href}
      className={cn('group/sidebar flex items-center justify-start gap-2 py-2', className)}
      {...props}
    >
      {link.icon}

      <motion.span
        animate={{
          display: animate ? (open ? 'inline-block' : 'none') : 'inline-block',
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        className="!m-0 inline-block whitespace-pre !p-0 text-sm text-neutral-700 transition duration-150 group-hover/sidebar:translate-x-1 dark:text-neutral-200"
      >
        {link.label}
      </motion.span>
    </a>
  );
};
