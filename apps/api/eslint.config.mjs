import { baseConfig } from '@droply/tooling/eslint/base';
import { cleanArchitectureConfig } from '@droply/tooling/eslint/clean-architecture';

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
