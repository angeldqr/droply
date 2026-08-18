import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * El marco de las pantallas de sesión. La marca queda arriba en versalitas
 * chicas y el peso visual lo lleva el título, no un logotipo.
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col justify-center px-6 py-16">
      <div className="mx-auto w-full max-w-sm">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground font-mono text-xs uppercase tracking-[0.2em] transition-colors"
        >
          Droply
        </Link>

        <Card className="border-border mt-6 border">
          <CardHeader>
            <CardTitle className="text-3xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>

        <p className="text-muted-foreground mt-6 text-center text-sm">{footer}</p>
      </div>
    </main>
  );
}
