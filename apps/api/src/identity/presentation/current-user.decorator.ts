import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { UserId } from '../../shared/identifiers';

/**
 * Saca el id del usuario que el guard ya dejó en la petición. Si esto se
 * evalúa, el guard pasó; una ruta `@Public()` no debería pedirlo.
 */
export const CurrentUserId = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<FastifyRequest>();
  const claims = request.claims;

  if (!claims) {
    throw new Error('CurrentUserId se usó en una ruta sin autenticación.');
  }

  return claims.userId satisfies UserId;
});
