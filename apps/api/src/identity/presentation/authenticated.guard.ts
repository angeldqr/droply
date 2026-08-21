import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import '../../platform/http/current-user.decorator';
import { IS_PUBLIC } from '../../platform/http/public.decorator';
import { REQUIRED_ROLE } from '../../platform/http/roles.decorator';
import { ForbiddenError, UnauthenticatedError } from '../../shared/domain-error';
import {
  ACCESS_TOKEN_ISSUER,
  USER_REPOSITORY,
  type AccessTokenIssuer,
  type UserRepository,
} from '../domain/ports';

/**
 * Se registra como guard global: las rutas nacen cerradas y hay que abrirlas a
 * mano con `@Public()`. Al revés —abiertas por defecto— basta con olvidarse un
 * decorador para dejar un endpoint expuesto.
 */
@Injectable()
export class AuthenticatedGuard implements CanActivate {
  constructor(
    // Explícito como los demás: sin `emitDecoratorMetadata` —que no emite el
    // transpilador de los tests— la inyección por tipo no existe en runtime.
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(ACCESS_TOKEN_ISSUER) private readonly accessTokens: AccessTokenIssuer,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = bearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthenticatedError('auth.missing_token', 'Inicia sesión para continuar.');
    }

    const claims = await this.accessTokens.verify(token);

    if (!claims) {
      throw new UnauthenticatedError('auth.invalid_token', 'Tu sesión venció, vuelve a entrar.');
    }

    request.userId = claims.userId;

    const required = this.reflector.getAllAndOverride<string>(REQUIRED_ROLE, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required) return true;

    /*
     * El rol se relee de la base, no viaja en el token.
     *
     * El token vive quince minutos: si el rol viniera dentro, alguien a quien
     * se le acaba de quitar el permiso seguiría administrando ese cuarto de
     * hora. Es una consulta más, y solo en las rutas restringidas.
     */
    const user = await this.users.findById(claims.userId);

    if (!user || user.role !== required) {
      throw new ForbiddenError('auth.forbidden', 'No tienes permiso para esto.');
    }

    return true;
  }
}

function bearerToken(header: string | undefined): string | null {
  if (!header) return null;

  const [scheme, value] = header.split(' ');

  return scheme?.toLowerCase() === 'bearer' && value ? value : null;
}
