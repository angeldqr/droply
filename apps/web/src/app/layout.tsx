import type { Metadata, Viewport } from 'next';
import { DM_Mono, DM_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

/*
 * Una sola familia para todo.
 *
 * DM Sans hace de título y de cuerpo: en grande, con peso 500 y apretada, tiene
 * carácter; en 14 y 16 píxeles se lee sin esfuerzo. DM Mono es su pareja de
 * ancho fijo y va en cifras, fechas y horas, para que las columnas de números
 * no bailen.
 */
const sans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const mono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Reconéctate',
  description: 'Bibliotecas de contenido que llegan solas, a la hora que elijas.',
};

export const viewport: Viewport = {
  themeColor: '#eef8ec',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
