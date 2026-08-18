import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { UserId } from '../../shared/identifiers';

declare module 'fastify' {
  interface FastifyRequest {
    /** Lo deja el guard de identity cuando el token es válido. */
    userId?: UserId;
  }
}

/**
 * Vive en `platform` y no en identity porque lo usa cualquier contexto que
 * tenga rutas con sesión, y un contexto de negocio no puede importar de otro.
 *
 * Identity es quien llena el campo; acá solo se lee.
 */
export const CurrentUserId = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<FastifyRequest>();

  if (!request.userId) {
    throw new Error('CurrentUserId se usó en una ruta sin autenticación.');
  }

  return request.userId;
});
