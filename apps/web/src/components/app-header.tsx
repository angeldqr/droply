'use client';

import Link from 'next/link';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSession } from '@/lib/session';

export function AppHeader({ children }: { children?: React.ReactNode }) {
  const { user, signOut } = useSession();

  return (
    <header className="border-border border-b">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-6">
        <Link
          href="/bibliotecas"
          className="text-muted-foreground hover:text-foreground font-mono text-xs uppercase tracking-[0.2em] transition-colors"
        >
          Droply
        </Link>

        <div className="flex-1">{children}</div>

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Tu cuenta">
                <Avatar className="size-8">
                  <AvatarFallback>{initialsOf(user.displayName)}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <span className="block truncate">{user.displayName}</span>
                <span className="text-muted-foreground block truncate text-xs">{user.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void signOut()}>Cerrar sesión</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </header>
  );
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
