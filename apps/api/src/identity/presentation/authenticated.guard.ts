import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import '../../platform/http/current-user.decorator';
import { IS_PUBLIC } from '../../platform/http/public.decorator';
import { UnauthenticatedError } from '../../shared/domain-error';
import { ACCESS_TOKEN_ISSUER, type AccessTokenIssuer } from '../domain/ports';

/**
 * Se registra como guard global: las rutas nacen cerradas y hay que abrirlas a
 * mano con `@Public()`. Al revés —abiertas por defecto— basta con olvidarse un
 * decorador para dejar un endpoint expuesto.
 */
@Injectable()
export class AuthenticatedGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(ACCESS_TOKEN_ISSUER) private readonly accessTokens: AccessTokenIssuer,
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

    return true;
  }
}

function bearerToken(header: string | undefined): string | null {
  if (!header) return null;

  const [scheme, value] = header.split(' ');

  return scheme?.toLowerCase() === 'bearer' && value ? value : null;
}
