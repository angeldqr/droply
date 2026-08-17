import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UsePipes,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  loginSchema,
  registerSchema,
  verifyEmailSchema,
  type AuthenticatedUser,
  type LoginInput,
  type RegisterInput,
  type SessionResponse,
  type VerifyEmailInput,
} from '@droply/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Public } from '../../platform/http/public.decorator';
import { ZodValidationPipe } from '../../platform/http/zod-validation.pipe';
import { NotFoundError } from '../../shared/domain-error';
import type { UserId } from '../../shared/identifiers';
import { orThrow } from '../../shared/result';
import { LoginUseCase } from '../application/login.use-case';
import { LogoutUseCase } from '../application/logout.use-case';
import { RefreshSessionUseCase } from '../application/refresh-session.use-case';
import { RegisterUserUseCase } from '../application/register-user.use-case';
import type { AuthenticatedSession } from '../application/session-issuer';
import { VerifyEmailUseCase } from '../application/verify-email.use-case';
import { USER_REPOSITORY, type UserRepository } from '../domain/ports';
import type { User } from '../domain/user';
import { CurrentUserId } from './current-user.decorator';
import { IS_PRODUCTION } from './tokens';

const REFRESH_COOKIE = 'droply_refresh';

/** Acotado a las rutas de sesión: no viaja en cada llamada del API. */
const REFRESH_COOKIE_PATH = '/api/auth';

@Controller('auth')
export class AuthController {
  /*
   * Cada dependencia lleva su `@Inject` explícito. Nest construye los
   * controladores por su cuenta, así que no alcanza con una factory en el
   * módulo; y como los puertos son interfaces —que no existen en runtime—, la
   * inyección por metadatos de tipo tampoco serviría.
   */
  constructor(
    @Inject(RegisterUserUseCase) private readonly registerUser: RegisterUserUseCase,
    @Inject(LoginUseCase) private readonly login: LoginUseCase,
    @Inject(RefreshSessionUseCase) private readonly refreshSession: RefreshSessionUseCase,
    @Inject(LogoutUseCase) private readonly logout: LogoutUseCase,
    @Inject(VerifyEmailUseCase) private readonly verifyEmail: VerifyEmailUseCase,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(IS_PRODUCTION) private readonly isProduction: boolean,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  // Crear cuentas es caro: cada intento hashea con argon2 y manda un correo.
  @Throttle({ medium: { limit: 5, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(registerSchema))
  async register(@Body() body: RegisterInput): Promise<{ userId: string }> {
    return orThrow(await this.registerUser.execute(body));
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ medium: { limit: 10, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(loginSchema))
  async signIn(
    @Body() body: LoginInput,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<SessionResponse> {
    return this.respond(orThrow(await this.login.execute(body)), reply);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  // Sin techo, este endpoint sirve para probar cookies robadas a discreción.
  @Throttle({ medium: { limit: 30, ttl: 60_000 } })
  async refresh(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<SessionResponse> {
    const presented = request.cookies[REFRESH_COOKIE] ?? '';

    return this.respond(orThrow(await this.refreshSession.execute(presented)), reply);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async signOut(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    await this.logout.execute(request.cookies[REFRESH_COOKIE]);

    reply.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ medium: { limit: 10, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(verifyEmailSchema))
  async verify(@Body() body: VerifyEmailInput): Promise<void> {
    orThrow(await this.verifyEmail.execute(body.token));
  }

  @Get('me')
  async me(@CurrentUserId() userId: UserId): Promise<AuthenticatedUser> {
    const user = await this.users.findById(userId);

    // El token es válido pero la cuenta ya no está: se borró mientras la
    // sesión seguía viva.
    if (!user) throw new NotFoundError('la cuenta', 'auth.user_gone');

    return toAuthenticatedUser(user);
  }

  private respond(authenticated: AuthenticatedSession, reply: FastifyReply): SessionResponse {
    /*
     * El refresco viaja en cookie `httpOnly` y no en el cuerpo: así ningún
     * script de la página puede leerlo, que es lo que convierte un XSS en un
     * robo de sesión permanente. El de acceso sí va en el cuerpo, porque dura
     * quince minutos y el front lo guarda en memoria.
     */
    reply.setCookie(REFRESH_COOKIE, authenticated.session.refreshToken, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH,
      expires: authenticated.session.refreshTokenExpiresAt,
    });

    return {
      accessToken: authenticated.session.accessToken,
      expiresInSeconds: authenticated.session.accessTokenExpiresInSeconds,
      user: toAuthenticatedUser(authenticated.user),
    };
  }
}

function toAuthenticatedUser(user: User): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email.value,
    displayName: user.displayName,
    timezone: user.timezone,
    emailVerified: user.isEmailVerified,
  };
}
