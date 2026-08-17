export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-6 py-24">
      <p className="text-mist-500 font-mono text-xs uppercase tracking-[0.2em]">Droply</p>

      <h1 className="text-mist-900 mt-6 text-balance text-5xl leading-[1.05] sm:text-6xl">
        Tus bibliotecas llegan solas, a la hora que elijas.
      </h1>

      <p className="text-mist-600 mt-6 max-w-xl text-lg leading-relaxed">
        Armá una colección de audios, videos, imágenes y textos. Elegí a quién y cuándo. El bot se
        encarga del resto.
      </p>

      <div className="border-mist-900/15 mt-12 border-t pt-6">
        <p className="text-mist-500 text-sm">
          En construcción. El andamiaje está listo: falta el producto.
        </p>
      </div>
    </main>
  );
}
