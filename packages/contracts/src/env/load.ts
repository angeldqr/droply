import type { z } from 'zod';

/**
 * Valida el entorno contra un esquema y, si algo falta o está mal, corta el
 * arranque con un mensaje que se entiende. Vale la pena morir acá y no seis
 * horas después, cuando un envío programado falla por un secreto vacío.
 *
 * Nunca imprime el valor de la variable, solo su nombre y qué esperaba.
 */
export function loadEnv<T extends z.ZodType>(schema: T, source: NodeJS.ProcessEnv = process.env) {
  const result = schema.safeParse(source);

  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(raíz)'}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `No se pudo leer la configuración del entorno:\n${problems}\n\n` +
        'Compará tu .env contra .env.example.',
    );
  }

  return result.data;
}
