import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    // next-env.d.ts lo regenera Next en cada build, con triple-slash incluido.
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
];

export default config;
