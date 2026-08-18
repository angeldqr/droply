'use client';

import { Archive, LibraryBig, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment } from 'react';
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
import { Separator } from '@/components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { useSession } from '@/lib/session';

/** Un escalón del rastro. El último no lleva enlace: ya estás ahí. */
export interface Crumb {
  readonly label: string;
  readonly href?: string;
}

/**
 * El armazón de la aplicación: panel lateral fijo a la izquierda y el resto de
 * la pantalla para el contenido.
 *
 * Antes la navegación vivía en una barra superior, que en un tablero de cuatro
 * columnas se comía alto justo donde hace falta. De lado no cuesta nada: se
 * pliega a un carril de iconos, y en móvil se convierte solo en un cajón.
 */
export function AppShell({ crumbs, children }: { crumbs: Crumb[]; children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <DroplySidebar />

      <SidebarInset>
        {/*
          La cabecera se queda pegada arriba porque el disparador del panel es
          la única forma de recuperarlo cuando está plegado, y en el tablero se
          baja mucho.

          Lleva el rastro y no el nombre de la aplicación: dentro de una
          biblioteca, "Droply" no decía nada que no dijera ya el panel lateral.
        */}
        <header className="bg-background/80 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-4 backdrop-blur-sm md:px-6">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-1 !h-4" />

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
      </SidebarInset>
    </SidebarProvider>
  );
}

/** Las dos pantallas de la aplicación, con la que estás abierta marcada. */
const SECTIONS = [
  { href: '/bibliotecas', label: 'Bibliotecas', icon: LibraryBig },
  { href: '/baul', label: 'Baúl', icon: Archive },
] as const;

function DroplySidebar() {
  const { user, signOut } = useSession();
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4">
        <Link href="/bibliotecas" className="flex items-center gap-3">
          {/*
            La gota del nombre, dibujada con el redondeo del sistema: un cuadro
            al que se le estira una esquina. Es lo único gráfico de la marca, y
            es lo que sigue viéndose cuando el panel se pliega a iconos.
          */}
          <span
            aria-hidden
            className="bg-primary size-7 shrink-0 rounded-full rounded-tl-sm shadow-sm"
          />
          <span className="font-display truncate text-lg font-semibold group-data-[collapsible=icon]:hidden">
            Droply
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Tu contenido</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {SECTIONS.map((section) => (
                <SidebarMenuItem key={section.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith(section.href)}
                    tooltip={section.label}
                  >
                    <Link href={section.href}>
                      <section.icon />
                      <span>{section.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" tooltip={user?.displayName ?? 'Tu cuenta'}>
                  <Avatar className="size-7">
                    <AvatarFallback>{initialsOf(user?.displayName ?? '')}</AvatarFallback>
                  </Avatar>
                  <span className="grid min-w-0 flex-1 text-left leading-tight">
                    <span className="truncate text-sm">{user?.displayName}</span>
                    <span className="text-muted-foreground truncate text-xs">{user?.email}</span>
                  </span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>

              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <span className="block truncate">{user?.displayName}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {user?.email}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void signOut()}>
                  <LogOut /> Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
