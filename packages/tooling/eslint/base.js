import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export const baseConfig = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSEnumDeclaration',
          message:
            'Usá union de literales o const objects; los enum de TS no existen en runtime JS.',
        },
      ],
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    // Los archivos de configuración quedan fuera del tsconfig de la app, así
    // que el análisis con tipos no puede resolverlos.
    files: ['**/*.config.{js,mjs,cjs,ts,mts}', '**/eslint.config.{js,mjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
  prettier,
  {
    ignores: ['dist/**', 'build/**', '.next/**', '.turbo/**', 'coverage/**', 'node_modules/**'],
  },
);

export default baseConfig;
