import { baseConfig } from '@droply/tooling/eslint/base';
import { cleanArchitectureConfig } from '@droply/tooling/eslint/clean-architecture';

export default [
  ...baseConfig,
  ...cleanArchitectureConfig,
  {
    rules: {
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
];
