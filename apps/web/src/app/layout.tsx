import type { Metadata, Viewport } from 'next';
import { Nunito, Quicksand } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

/*
 * Dos redondeadas que se complementan sin competir.
 *
 * Quicksand es geométrica y de terminaciones circulares: funciona en títulos
 * grandes y ahí se le nota el carácter. En cuerpo pequeño pierde legibilidad,
 * así que todo lo demás va en Nunito, que es redondeada pero con formas más
 * abiertas y aguanta bien los 14 y 16 píxeles de la interfaz.
 */
const display = Quicksand({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-quicksand',
  display: 'swap',
});

const sans = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Droply',
  description: 'Bibliotecas de contenido que llegan solas, a la hora que elijas.',
};

export const viewport: Viewport = {
  themeColor: '#f4effa',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
