import type { Metadata, Viewport } from 'next';
import { Instrument_Serif, Inter_Tight } from 'next/font/google';
import './globals.css';

const display = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-instrument-serif',
  display: 'swap',
});

const sans = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-inter-tight',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Droply',
  description: 'Bibliotecas de contenido que llegan solas, a la hora que elijas.',
};

export const viewport: Viewport = {
  themeColor: '#e1edf5',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
