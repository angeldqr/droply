import { Injectable, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { InvalidInputError } from '../../shared/domain-error';

/**
 * Valida el cuerpo, los params o el query contra un esquema de
 * `@droply/contracts` y devuelve el dato ya tipado. Lo que no está en el
 * esquema se descarta, así nada inesperado llega al caso de uso.
 */
@Injectable()
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      const fields: Record<string, string> = {};
      for (const issue of result.error.issues) {
        fields[issue.path.join('.') || '_'] = issue.message;
      }

      throw new InvalidInputError('validation_failed', 'Los datos enviados no son válidos.', {
        fields,
      });
    }

    return result.data;
  }
}
