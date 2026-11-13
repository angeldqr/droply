'use client';

import {
  Archive,
  CalendarClock,
  House,
  LibraryBig,
  LogOut,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  ShieldCheck,
  Sparkles,
  UserCog,
} from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FloatingDock } from '@/components/ui/floating-dock';
import { DesktopSidebar, Sidebar, useSidebar } from '@/components/ui/sidebar';
import { useSession } from '@/lib/session';

/** Un escalón del rastro. El último no lleva enlace: ya estás ahí. */
export interface Crumb {
  readonly label: string;
  readonly href?: string;
}

/**
 * El armazón de la aplicación.
 *
 * El panel lateral va fijo y abierto, con un botón para recogerlo a un carril
 * de iconos; recogido, se abre solo al pasar el ratón por encima. La elección
 * se recuerda en el navegador. En el teléfono no hay panel: arriba queda la
 * marca con el menú de la cuenta, y abajo un dock con las secciones.
 *
 * Es una tarjeta más sobre el fondo: se despega por su relieve y no por un
 * color propio, así el acento menta queda para la página abierta.
 */
export function AppShell({
  crumbs,
  actions,
  children,
}: {
  crumbs: Crumb[];
  /** Los botones de la pantalla. Van en la barra, a la derecha del título. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  // El estado vive acá y no dentro del panel para que el resto de la pantalla
  // pueda reaccionar a la apertura si alguna vez hace falta.
  const [open, setOpen] = useState(false);
  const parents = crumbs.slice(0, -1);
  const title = crumbs.at(-1)?.label ?? '';

  return (
    <div className="flex min-h-dvh w-full flex-col md:flex-row">
      <Sidebar open={open} setOpen={setOpen}>
        <DesktopSidebar className="bg-sidebar text-sidebar-foreground justify-between gap-8">
          <ReconectateNav />
        </DesktopSidebar>
      </Sidebar>

      <div className="bg-background flex h-14 w-full items-center justify-between px-4 md:hidden">
        <MobileBrand />
        <UserMenu compact />
      </div>

      {/*
        Cada pantalla monta su propio armazón, así que esto corre en cada cambio
        de página: un fundido corto del contenido, sin mover el menú. En el
        teléfono el dock flota sobre el final de la página: se le deja su hueco.
      */}
      <main className="animate-aparecer flex min-w-0 flex-1 flex-col pb-24 md:pb-2">
        {/*
          El título de la pantalla vive en la barra y no debajo: así el contenido
          empieza arriba y las acciones quedan siempre a la vista al desplazarse.
        */}
        <header className="bg-background/80 sticky top-0 z-30 flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 backdrop-blur-md md:pl-2 md:pr-4">
          <div className="min-w-0 flex-1">
            {parents.length > 0 ? (
              <Breadcrumb>
                <BreadcrumbList>
                  {parents.map((crumb, index) => (
                    <Fragment key={crumb.label}>
                      {index > 0 ? <BreadcrumbSeparator /> : null}
                      <BreadcrumbItem>
                        {crumb.href ? (
                          <BreadcrumbLink asChild>
                            <Link href={crumb.href}>{crumb.label}</Link>
                          </BreadcrumbLink>
                        ) : (
                          <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                        )}
                      </BreadcrumbItem>
                    </Fragment>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
            ) : null}
            <h1 className="truncate text-2xl leading-tight">{title}</h1>
          </div>

          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </header>

        <div className="flex flex-1 flex-col px-4 md:pl-2 md:pr-4">{children}</div>
      </main>

      <MobileDock />
    </div>
  );
}

/*
 * Las pantallas, en grupos porque son cosas distintas: lo que se envía, a quién
 * se le envía y qué se consiguió con ello. Mezclarlas en una lista sola haría
 * parecer que "Destinatarios" es otra caja de contenido.
 */
const SECTIONS = [
  {
    label: 'Hoy',
    items: [{ href: '/inicio', label: 'Inicio', icon: House }],
  },
  {
    label: 'Tu contenido',
    items: [
      { href: '/bibliotecas', label: 'Bibliotecas', icon: LibraryBig },
      { href: '/baul', label: 'Baúl', icon: Archive },
    ],
  },
  {
    label: 'Envíos',
    items: [
      { href: '/destinatarios', label: 'Destinatarios', icon: Send },
      { href: '/horarios', label: 'Horarios', icon: CalendarClock },
    ],
  },
  /*
   * Los planes de hábitos van en su propio grupo y no dentro de "Envíos".
   *
   * No son otra forma de mandar cosas: son lo que se hace con lo que ya se
   * manda. Meterlos ahí abajo los haría parecer una variante de "Horarios", y
   * lo que miden —si la persona del otro lado cumplió— no tiene nada que ver.
   */
  {
    label: 'Mi yo del futuro',
    items: [{ href: '/yo-en-30-dias', label: 'Yo en 30 días', icon: Sparkles }],
  },
  /*
   * La bitácora va aparte de «Mi yo del futuro», aunque las dos hablen de
   * hábitos. Aquello mide lo que la aplicación mandó; esto guarda lo que el
   * usuario cuenta desde el chat, y no recuerda nada. Bajo el mismo rótulo
   * parecerían dos vistas de lo mismo.
   */
  {
    label: 'Hábitos',
    items: [{ href: '/habitos', label: 'Mi bitácora', icon: NotebookPen }],
  },
] as const;

/** Solo para quien administra. Va aparte porque no es contenido de nadie. */
const ADMIN_SECTION = {
  label: 'Sistema',
  items: [{ href: '/admin', label: 'Administración', icon: ShieldCheck }],
} as const;

/** Las secciones que ve esta cuenta: las de todos y, si administra, la del sistema. */
function useGroups() {
  const { user } = useSession();

  return [...SECTIONS, ...(user?.role === 'ADMIN' ? [ADMIN_SECTION] : [])];
}

function ReconectateNav() {
  const pathname = usePathname();
  const groups = useGroups();

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Wordmark />
          <PinButton />
        </div>

        {groups.map((group) => (
          <div key={group.label} className="mt-3 flex flex-col gap-1">
            <GroupLabel>{group.label}</GroupLabel>

            {group.items.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={<item.icon className="size-5 shrink-0" />}
                active={pathname.startsWith(item.href)}
              />
            ))}
          </div>
        ))}
      </div>

      <UserMenu />
    </>
  );
}

/**
 * La navegación del teléfono: un dock fijo abajo con una entrada por sección.
 *
 * Reemplaza al cajón de pantalla completa: cambiar de sección es un toque y no
 * dos. Los grupos del panel no caben acá; el orden de los iconos los conserva.
 */
function MobileDock() {
  const pathname = usePathname();
  const items = useGroups().flatMap((group) =>
    group.items.map((item) => ({
      title: item.label,
      href: item.href,
      icon: <item.icon className="size-full" />,
      active: pathname.startsWith(item.href),
    })),
  );

  return (
    <nav
      aria-label="Secciones"
      className="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center md:hidden"
    >
      <FloatingDock
        items={items}
        desktopClassName="pointer-events-auto flex h-14 items-center gap-2 px-2 pb-0"
        mobileClassName="hidden"
      />
    </nav>
  );
}

/**
 * El menú de la cuenta. En el panel lleva el nombre al lado; en la barra del
 * teléfono (`compact`) es solo el avatar y se abre hacia abajo.
 */
function UserMenu({ compact = false }: { compact?: boolean }) {
  const { user, signOut } = useSession();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={compact ? 'Tu cuenta' : undefined}
          className="hover:bg-sidebar-accent focus-visible:ring-sidebar-ring flex items-center gap-3 rounded-full p-1.5 text-left outline-none transition-colors focus-visible:ring-2"
        >
          <Avatar className="size-7 shrink-0">
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
              {initialsOf(user?.displayName ?? '')}
            </AvatarFallback>
          </Avatar>
          {compact ? null : (
            <Reveal className="grid min-w-0 leading-tight">
              <span className="truncate text-sm">{user?.displayName}</span>
              <span className="truncate text-xs opacity-70">{user?.email}</span>
            </Reveal>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side={compact ? 'bottom' : 'top'}
        align={compact ? 'end' : 'start'}
        className="w-56"
      >
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate">{user?.displayName}</span>
          <span className="text-muted-foreground block truncate text-xs">{user?.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/cuenta">
            <UserCog /> Tu cuenta
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Lo que solo se ve con el panel abierto.
 *
 * Se animan la opacidad y el ancho en vez de quitarlo del árbol, para que el
 * texto no salte de golpe al entrar y salir el ratón.
 */
function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const { open, animate } = useSidebar();
  const visible = animate ? open : true;

  return (
    <motion.span
      animate={{ opacity: visible ? 1 : 0, width: visible ? 'auto' : 0 }}
      transition={{ duration: 0.15 }}
      className={`overflow-hidden whitespace-nowrap ${className ?? ''}`}
    >
      {children}
    </motion.span>
  );
}

/**
 * El rótulo de un grupo, que desaparece del todo al plegar el panel.
 *
 * Se anima el alto además de la opacidad: con solo esconder el texto, la línea
 * seguía ocupando su sitio y dejaba huecos grandes entre los grupos de iconos.
 */
function GroupLabel({ children }: { children: React.ReactNode }) {
  const { open, animate } = useSidebar();
  const visible = animate ? open : true;

  return (
    <motion.div
      animate={{ opacity: visible ? 1 : 0, height: visible ? 'auto' : 0 }}
      transition={{ duration: 0.15 }}
      className="overflow-hidden whitespace-nowrap px-2 font-mono text-[10px] uppercase tracking-[0.18em] opacity-60"
    >
      <span className="block pb-1">{children}</span>
    </motion.div>
  );
}

/**
 * Una entrada del panel.
 *
 * No se usa el `SidebarLink` que trae el componente: navega con un `<a>` suelto
 * —recarga la página entera— y lleva sus propios grises fijos, que no son los
 * de la paleta. La animación de apertura sí es la suya, que es lo que se vino
 * a buscar.
 */
function NavLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`group/nav focus-visible:ring-sidebar-ring relative flex items-center gap-3 rounded-full px-2 py-2 outline-none transition-colors focus-visible:ring-2 ${
        active ? 'font-medium' : 'hover:bg-sidebar-accent'
      }`}
    >
      {/*
        La marca de la página abierta es una píldora menta detrás de la entrada.
        Va rebajada para que el icono se siga leyendo con el panel plegado.
        `layoutId` hace que se deslice de una entrada a otra al navegar, en vez
        de aparecer y desaparecer.
      */}
      {active ? (
        <motion.span
          layoutId="nav-activa"
          transition={{ type: 'spring', duration: 0.45, bounce: 0.2 }}
          className="bg-menta/45 absolute inset-0 rounded-full"
        />
      ) : null}

      {/* El icono de la página abierta va más grueso: es lo que queda con el panel plegado. */}
      <span
        className={`relative shrink-0 transition-transform group-hover/nav:translate-x-0.5 ${
          active ? '[&_svg]:stroke-[2.5]' : ''
        }`}
      >
        {icon}
      </span>
      <Reveal className="relative text-sm">{label}</Reveal>
    </Link>
  );
}

/**
 * Fija o recoge el panel de escritorio. Solo aparece con el panel abierto: con
 * el carril de iconos no cabe, y al pasar el ratón ya se ve.
 */
function PinButton() {
  const { open, pinned, setPinned } = useSidebar();

  if (!open) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-sidebar-ring hidden size-8 shrink-0 md:inline-flex"
      onClick={() => setPinned(!pinned)}
      aria-label={pinned ? 'Recoger menú' : 'Fijar menú'}
      title={pinned ? 'Recoger menú' : 'Fijar menú'}
    >
      {pinned ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
    </Button>
  );
}

function Wordmark() {
  return (
    <Link
      href="/inicio"
      className="focus-visible:ring-sidebar-ring flex items-center gap-3 rounded-lg px-1 py-1 outline-none focus-visible:ring-2"
    >
      {/*
        La gota del nombre: un círculo al que se le cuadra una esquina. Es lo
        único gráfico de la marca, y lo que sigue viéndose con el panel plegado.
      */}
      <span
        aria-hidden
        className="bg-sidebar-primary size-7 shrink-0 rounded-full rounded-tl-sm shadow-sm"
      />
      <Reveal className="font-display text-lg font-medium tracking-tight">Reconéctate</Reveal>
    </Link>
  );
}

/**
 * La marca en la barra del teléfono: la gota y el nombre, siempre a la vista.
 * No usa `Reveal`, que la escondería con el panel cerrado.
 */
function MobileBrand() {
  return (
    <Link
      href="/inicio"
      className="focus-visible:ring-sidebar-ring flex items-center gap-2 rounded-lg outline-none focus-visible:ring-2"
    >
      <span
        aria-hidden
        className="bg-sidebar-primary size-6 shrink-0 rounded-full rounded-tl-sm shadow-sm"
      />
      <span className="font-display text-base font-medium tracking-tight">Reconéctate</span>
    </Link>
  );
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
