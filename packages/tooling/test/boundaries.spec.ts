import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { beforeAll, describe, expect, it } from 'vitest';
import { cleanArchitectureConfig } from '../eslint/clean-architecture.js';

/**
 * La regla de dependencia es lo único que sostiene la arquitectura, y la
 * sostiene ESLint. Si un día una configuración deja de matchear los patrones,
 * el lint pasaría en verde sobre código que rompe todas las capas y nadie se
 * enteraría.
 *
 * Estos fixtures son un backend de mentira con dos contextos, `billing` y
 * `catalog`. Acá se comprueba que lo prohibido falle y lo permitido pase.
 */
const fixtures = fileURLToPath(new URL('./fixtures', import.meta.url));

type Finding = { rule: string; message: string };

let findings: Map<string, Finding[]>;

async function lintFixtures(): Promise<Map<string, Finding[]>> {
  const eslint = new ESLint({
    cwd: fixtures,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.ts'],
        languageOptions: { parser: tseslint.parser },
      },
      ...cleanArchitectureConfig,
      // El plugin arma las rutas relativas contra `process.cwd()`, no contra el
      // `cwd` de ESLint. Sin esto los fixtures caen fuera del `include` y las
      // reglas no llegan a evaluarse nunca.
      { settings: { 'boundaries/root-path': fixtures } },
    ],
  });

  const root = fixtures.replaceAll('\\', '/');
  const results = await eslint.lintFiles(['src/**/*.ts']);

  return new Map(
    results.map((result) => [
      result.filePath.replaceAll('\\', '/').slice(root.length + 1),
      result.messages
        .filter((message) => message.ruleId?.startsWith('boundaries/'))
        .map((message) => ({
          rule: message.ruleId?.replace('boundaries/', '') ?? '',
          message: message.message,
        })),
    ]),
  );
}

function findingsFor(file: string): Finding[] {
  const found = findings.get(file);
  if (!found) {
    throw new Error(
      `El fixture ${file} no fue analizado. Fixtures vistos: ${[...findings.keys()].join(', ')}`,
    );
  }
  return found;
}

/** El par de capas exacto, que es lo que distingue una violación de otra. */
function blockedImport(from: string, to: string): Finding {
  return {
    rule: 'element-types',
    message: `Import no permitido: \`${from}\` → \`${to}\`. O rompe la regla de dependencia, o cruza a otro contexto de negocio.`,
  };
}

describe('regla de dependencia', () => {
  beforeAll(async () => {
    findings = await lintFixtures();
  });

  it('analiza todos los fixtures y ninguno queda sin mirar', () => {
    expect([...findings.keys()].sort()).toEqual([
      'src/billing/application/pay-invoice.ts',
      'src/billing/application/reaches-infrastructure.ts',
      'src/billing/application/reaches-other-context.ts',
      'src/billing/domain/invoice.ts',
      'src/billing/domain/reaches-npm.ts',
      'src/billing/domain/reaches-platform.ts',
      'src/billing/domain/reaches-scoped-npm.ts',
      'src/billing/helpers/orphan.ts',
      'src/billing/infrastructure/invoice.repository.ts',
      'src/billing/presentation/billing.module.ts',
      'src/catalog/domain/product.ts',
      'src/platform/db.ts',
      'src/shared/kernel.ts',
    ]);
  });

  describe('lo que debe pasar', () => {
    it('el dominio se apoya en el kernel compartido', () => {
      expect(findingsFor('src/billing/domain/invoice.ts')).toEqual([]);
    });

    it('un caso de uso usa el dominio de su propio contexto', () => {
      expect(findingsFor('src/billing/application/pay-invoice.ts')).toEqual([]);
    });

    it('la infraestructura usa plataforma y su propio dominio', () => {
      expect(findingsFor('src/billing/infrastructure/invoice.repository.ts')).toEqual([]);
    });

    it('el módulo cablea el caso de uso con su implementación concreta', () => {
      expect(findingsFor('src/billing/presentation/billing.module.ts')).toEqual([]);
    });
  });

  describe('lo que debe romper el lint', () => {
    it('el dominio no toca la capa de plataforma', () => {
      expect(findingsFor('src/billing/domain/reaches-platform.ts')).toEqual([
        blockedImport('domain', 'platform'),
      ]);
    });

    it('el dominio no importa paquetes de npm', () => {
      expect(findingsFor('src/billing/domain/reaches-npm.ts')).toEqual([
        {
          rule: 'external',
          message: expect.stringContaining('El núcleo es TypeScript puro') as unknown as string,
        },
      ]);
    });

    it('tampoco pasa un paquete con scope', () => {
      expect(findingsFor('src/billing/domain/reaches-scoped-npm.ts')).toEqual([
        {
          rule: 'external',
          message: expect.stringContaining('El núcleo es TypeScript puro') as unknown as string,
        },
      ]);
    });

    it('un caso de uso no depende de una implementación concreta', () => {
      expect(findingsFor('src/billing/application/reaches-infrastructure.ts')).toEqual([
        blockedImport('application', 'infrastructure'),
      ]);
    });

    it('un contexto no mete mano en el dominio de otro', () => {
      expect(findingsFor('src/billing/application/reaches-other-context.ts')).toEqual([
        blockedImport('application', 'domain'),
      ]);
    });

    it('una carpeta que no es ninguna de las capas no queda sin vigilancia', () => {
      const rules = findingsFor('src/billing/helpers/orphan.ts').map((finding) => finding.rule);

      expect(rules).toContain('no-unknown-files');
    });
  });
});
