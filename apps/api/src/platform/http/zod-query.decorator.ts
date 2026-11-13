import { Query } from '@nestjs/common';
import type { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

/**
 * Como `ZodBody`, para lo que llega en la dirección después del `?`.
 *
 * Los parámetros de consulta llegan todos como texto: el esquema es quien los
 * convierte (`z.coerce`) y quien les pone valores por defecto.
 */
export function ZodQuery<T extends z.ZodType>(schema: T): ParameterDecorator {
  return Query(new ZodValidationPipe(schema));
}
