import { join } from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@reconectate/ui', '@reconectate/contracts'],
  // Empaqueta el servidor con solo las dependencias que usa, para la imagen.
  output: 'standalone',
  outputFileTracingRoot: join(import.meta.dirname, '../../'),

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default config;
