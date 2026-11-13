import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * El marco de las pantallas de sesión: la noche de la portada con una sola
 * tarjeta clara en el centro. La marca queda arriba, con su gota, y el peso
 * visual lo lleva el título.
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
    <main className="bg-noche flex min-h-dvh flex-col justify-center px-4 py-16">
      <div className="animate-asentar mx-auto w-full max-w-sm">
        <Link
          href="/"
          className="text-noche-tinta focus-visible:outline-menta flex w-fit items-center gap-3 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <span aria-hidden className="bg-menta size-7 rounded-full rounded-tl-sm" />
          <span className="font-display text-lg font-medium tracking-tight">Reconéctate</span>
        </Link>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-3xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>

        {/* Los enlaces del pie llegan con la tinta de la app, que acá no se lee. */}
        <p className="text-noche-apagado [&_a]:text-noche-tinta! mt-6 text-center text-sm">
          {footer}
        </p>
      </div>
    </main>
  );
}
