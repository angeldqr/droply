import { Body } from '@nestjs/common';
import type { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

/**
 * Valida el cuerpo contra un esquema y deja el resto de los parámetros en paz.
 *
 * `@UsePipes` aplicaría el mismo pipe a todo lo que entra al handler, así que
 * los `@Param` de la ruta también irían a parar contra el esquema del cuerpo y
 * fallarían siempre.
 */
export function ZodBody<T extends z.ZodType>(schema: T): ParameterDecorator {
  return Body(new ZodValidationPipe(schema));
}
