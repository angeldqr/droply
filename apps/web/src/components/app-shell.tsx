'use client';

import {
  Archive,
  CalendarClock,
  LibraryBig,
  LogOut,
  Send,
  ShieldCheck,
  UserCog,
} from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { Sidebar, SidebarBody, useSidebar } from '@/components/ui/sidebar';
import { useSession } from '@/lib/session';

/** Un escalón del rastro. El último no lleva enlace: ya estás ahí. */
export interface Crumb {
  readonly label: string;
  readonly href?: string;
}

/**
 * El armazón de la aplicación.
 *
 * El panel lateral vive plegado a un carril de iconos y se abre solo al pasar
 * el ratón por encima: no hay que apretar nada para ver dónde estás, y en
 * cuanto te vas vuelve a dejar el ancho al contenido. En móvil es un cajón que
 * entra desde la izquierda.
 *
 * Va oscuro contra una aplicación clara, y es la decisión más visible de la
 * paleta: la ciruela ancla la pantalla por la izquierda y hace que el contenido
 * —tarjetas blancas sobre papel lavanda— se lea como lo que importa.
 */
export function AppShell({ crumbs, children }: { crumbs: Crumb[]; children: React.ReactNode }) {
  // El estado vive acá y no dentro del panel para que el resto de la pantalla
  // pueda reaccionar a la apertura si alguna vez hace falta.
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-dvh w-full flex-col md:flex-row">
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:h-dvh md:justify-between md:gap-8">
          <DroplyNav />
        </SidebarBody>
      </Sidebar>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/70 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-4 backdrop-blur-sm md:px-6">
          <Breadcrumb>
            <BreadcrumbList>
              {crumbs.map((crumb, index) => (
                <Fragment key={crumb.label}>
                  {index > 0 ? <BreadcrumbSeparator /> : null}
                  <BreadcrumbItem className="min-w-0">
                    {crumb.href ? (
                      <BreadcrumbLink asChild>
                        <Link href={crumb.href}>{crumb.label}</Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        {children}
      </main>
    </div>
  );
}

/*
 * Las pantallas, en dos grupos porque son dos cosas distintas: lo que se envía
 * y a quién se le envía. Mezclarlas en una lista sola haría parecer que
 * "Destinatarios" es otra caja de contenido.
 */
const SECTIONS = [
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
] as const;

/** Solo para quien administra. Va aparte porque no es contenido de nadie. */
const ADMIN_SECTION = {
  label: 'Sistema',
  items: [{ href: '/admin', label: 'Administración', icon: ShieldCheck }],
} as const;

function DroplyNav() {
  const { user, signOut } = useSession();
  const pathname = usePathname();
  const groups = [...SECTIONS, ...(user?.role === 'ADMIN' ? [ADMIN_SECTION] : [])];

  return (
    <>
      <div className="flex flex-col gap-2">
        <Wordmark />

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

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="hover:bg-sidebar-accent flex items-center gap-3 rounded-lg p-2 text-left transition-colors"
          >
            <Avatar className="size-7 shrink-0">
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                {initialsOf(user?.displayName ?? '')}
              </AvatarFallback>
            </Avatar>
            <Reveal className="grid min-w-0 leading-tight">
              <span className="truncate text-sm">{user?.displayName}</span>
              <span className="truncate text-xs opacity-70">{user?.email}</span>
            </Reveal>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent side="top" align="start" className="w-56">
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
    </>
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
      className={`group/nav relative flex items-center gap-3 rounded-lg px-2 py-2 transition-colors ${
        active ? 'bg-sidebar-accent' : 'hover:bg-sidebar-accent/60'
      }`}
    >
      {/*
        La marca de la página abierta es una barra a la izquierda y no un fondo
        sólido: con el panel plegado a iconos, un fondo entero tapa el icono y
        una barra sigue leyéndose. `layoutId` hace que la barra se deslice de
        una entrada a otra al navegar, en vez de aparecer y desaparecer.
      */}
      {active ? (
        <motion.span
          layoutId="nav-activa"
          className="bg-sidebar-primary absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full"
        />
      ) : null}

      <span className="shrink-0 transition-transform group-hover/nav:translate-x-0.5">{icon}</span>
      <Reveal className="text-sm">{label}</Reveal>
    </Link>
  );
}

function Wordmark() {
  return (
    <Link href="/bibliotecas" className="flex items-center gap-3 px-1 py-1">
      {/*
        La gota del nombre: un círculo al que se le cuadra una esquina. Es lo
        único gráfico de la marca, y lo que sigue viéndose con el panel plegado.
      */}
      <span
        aria-hidden
        className="bg-sidebar-primary size-7 shrink-0 rounded-full rounded-tl-sm shadow-sm"
      />
      <Reveal className="font-display text-lg font-semibold">Droply</Reveal>
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
