import { AuthDialog } from '@/components/auth-dialog';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-6 py-24">
      <p className="text-muted-foreground font-mono text-xs uppercase tracking-[0.2em]">
        Reconéctate
      </p>

      <h1 className="mt-6 text-balance text-5xl leading-[1.05] sm:text-6xl">
        Tus bibliotecas llegan solas, a la hora que elijas.
      </h1>

      <p className="text-muted-foreground mt-6 max-w-xl text-lg leading-relaxed">
        Arma una colección de audios, videos, imágenes y textos. Elige a quién y cuándo. El bot se
        encarga del resto.
      </p>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <AuthDialog modo="entrar" />
        <span className="text-muted-foreground text-sm">
          Las cuentas las crea quien administra Reconéctate.
        </span>
      </div>
    </main>
  );
}
