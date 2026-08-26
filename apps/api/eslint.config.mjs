import { baseConfig } from '@reconectate/tooling/eslint/base';
import { cleanArchitectureConfig } from '@reconectate/tooling/eslint/clean-architecture';

export default [
  ...baseConfig,
  ...cleanArchitectureConfig,
  {
    rules: {
      // Los módulos de Nest son clases vacías a propósito: todo vive en el
      // decorador.
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
];
