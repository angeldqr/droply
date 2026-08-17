import boundaries from 'eslint-plugin-boundaries';

/**
 * Hace cumplir la regla de dependencia: todo apunta hacia adentro.
 *
 *   presentation ─┐
 *                 ├─> application ─> domain ─> shared
 *   infrastructure┘
 *
 * Y la separación por contexto: `libraries` no puede meter mano en el dominio
 * de `delivery`. Si necesitan hablarse, es por un puerto o por un evento.
 *
 * El orden de los elementos importa: gana el primer patrón que matchea.
 */
export const cleanArchitectureConfig = [
  {
    plugins: { boundaries },
    settings: {
      // Sin este resolver, boundaries no sabe a qué archivo apunta un import
      // relativo sin extensión y deja pasar las violaciones entre capas.
      'import/resolver': {
        typescript: { alwaysTryTypes: true },
        node: { extensions: ['.ts', '.tsx', '.js'] },
      },
      'boundaries/include': ['src/**/*.ts'],
      'boundaries/elements': [
        {
          type: 'shared',
          pattern: 'src/shared/**/*',
          mode: 'full',
        },
        {
          // Cableado de framework: Prisma, config, logger, filtros. No es un
          // contexto de negocio, así que vive aparte y nadie del núcleo lo ve.
          type: 'platform',
          pattern: 'src/platform/**/*',
          mode: 'full',
        },
        {
          type: 'root',
          pattern: 'src/*.ts',
          mode: 'full',
        },
        {
          type: 'domain',
          pattern: 'src/*/domain/**/*',
          mode: 'full',
          capture: ['context'],
        },
        {
          type: 'application',
          pattern: 'src/*/application/**/*',
          mode: 'full',
          capture: ['context'],
        },
        {
          type: 'infrastructure',
          pattern: 'src/*/infrastructure/**/*',
          mode: 'full',
          capture: ['context'],
        },
        {
          type: 'presentation',
          pattern: 'src/*/presentation/**/*',
          mode: 'full',
          capture: ['context'],
        },
      ],
    },
    rules: {
      /*
       * Sin esta regla queda un agujero silencioso: un archivo en
       * `src/libraries/helpers/` no matchea ninguna capa, así que ninguna otra
       * regla lo evalúa y puede importar lo que se le antoje. Acá se obliga a
       * que todo archivo viva en una capa conocida.
       */
      'boundaries/no-unknown-files': 'error',

      /* Y esta impide importar uno de esos archivos huérfanos desde una capa. */
      'boundaries/no-unknown': 'error',

      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          /*
           * El mensaje se define una sola vez, acá. `boundaries` solo usa el
           * mensaje propio de una regla cuando esa regla es de `disallow`; como
           * abajo son todas listas de `allow` sobre un default prohibitivo,
           * cualquier mensaje por regla sería código muerto.
           */
          message:
            'Import no permitido: `${file.type}` → `${dependency.type}`. O rompe la regla de dependencia, o cruza a otro contexto de negocio.',
          rules: [
            {
              from: ['shared'],
              allow: ['shared'],
            },
            {
              from: ['platform'],
              allow: ['platform', 'shared'],
            },
            {
              from: ['domain'],
              allow: ['shared', ['domain', { context: '${from.context}' }]],
            },
            {
              from: ['application'],
              allow: [
                'shared',
                ['domain', { context: '${from.context}' }],
                ['application', { context: '${from.context}' }],
              ],
            },
            {
              from: ['infrastructure'],
              allow: [
                'shared',
                'platform',
                ['domain', { context: '${from.context}' }],
                ['application', { context: '${from.context}' }],
                ['infrastructure', { context: '${from.context}' }],
              ],
            },
            {
              // El módulo de Nest vive acá y es el composition root: es el único
              // lugar donde se conocen a la vez el puerto y su implementación.
              from: ['presentation'],
              allow: [
                'shared',
                'platform',
                ['domain', { context: '${from.context}' }],
                ['application', { context: '${from.context}' }],
                ['infrastructure', { context: '${from.context}' }],
                ['presentation', { context: '${from.context}' }],
              ],
            },
            {
              from: ['root'],
              allow: ['shared', 'platform', 'root', 'presentation'],
            },
          ],
        },
      ],

      'boundaries/external': [
        'error',
        {
          default: 'allow',
          rules: [
            {
              // Nada de fuera entra al núcleo: ni frameworks, ni utilidades, ni
              // una librería de fechas. Es una negación total y no una
              // enumeración, porque una lista negra siempre se queda corta y
              // deja entrar lo que nadie previó.
              //
              // `shared` está incluido porque el dominio lo importa: si acá se
              // colara algo, el dominio lo arrastraría de forma transitiva.
              from: ['domain', 'application', 'shared'],
              disallow: ['*', '@*/*'],
              message:
                'El núcleo es TypeScript puro. Definí un puerto en `domain/ports` y llevá `${dependency.source}` a `infrastructure/`.',
            },
          ],
        },
      ],
    },
  },
  {
    // Los tests montan sus propios dobles y necesitan cruzar capas.
    files: ['**/*.spec.ts', '**/*.test.ts', '**/__tests__/**'],
    rules: {
      'boundaries/element-types': 'off',
      'boundaries/external': 'off',
      'boundaries/no-unknown-files': 'off',
      'boundaries/no-unknown': 'off',
    },
  },
  {
    files: ['**/*.config.{js,mjs,cjs,ts,mts}', '**/eslint.config.{js,mjs}'],
    rules: {
      'boundaries/element-types': 'off',
      'boundaries/external': 'off',
      'boundaries/no-unknown-files': 'off',
      'boundaries/no-unknown': 'off',
    },
  },
];

export default cleanArchitectureConfig;
