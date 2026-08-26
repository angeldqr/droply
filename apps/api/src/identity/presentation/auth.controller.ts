import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  setAccountActiveSchema,
  verifyEmailSchema,
  type AuthenticatedUser,
  type ChangePasswordInput,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
  type SessionResponse,
  type SetAccountActiveInput,
  type TemporaryPasswordView,
  type VerifyEmailInput,
} from '@reconectate/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { CurrentUserId } from '../../platform/http/current-user.decorator';
import { Public } from '../../platform/http/public.decorator';
import { Roles } from '../../platform/http/roles.decorator';
import { ZodBody } from '../../platform/http/zod-body.decorator';
import { InvalidInputError } from '../../shared/domain-error';
import { UserId } from '../../shared/identifiers';
import { orThrow } from '../../shared/result';
import {
  DeleteAccount,
  ResetAccountPassword,
  SetAccountActive,
} from '../application/account-admin-use-cases';
import { LoginUseCase } from '../application/login.use-case';
import {
  ChangePassword,
  RequestPasswordReset,
  ResetPassword,
} from '../application/password-use-cases';
import { LogoutUseCase } from '../application/logout.use-case';
import { RefreshSessionUseCase } from '../application/refresh-session.use-case';
import { RegisterUserUseCase } from '../application/register-user.use-case';
import type { AuthenticatedSession } from '../application/session-issuer';
import { ResendVerificationUseCase } from '../application/resend-verification.use-case';
import { VerifyEmailUseCase } from '../application/verify-email.use-case';
import type { User } from '../domain/user';
import { IS_PRODUCTION } from './tokens';

const REFRESH_COOKIE = 'reconectate_refresh';

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
    @Inject(ResendVerificationUseCase)
    private readonly resendVerification: ResendVerificationUseCase,
    @Inject(ChangePassword) private readonly changePassword: ChangePassword,
    @Inject(ResetAccountPassword) private readonly resetAccountPassword: ResetAccountPassword,
    @Inject(SetAccountActive) private readonly setAccountActive: SetAccountActive,
    @Inject(DeleteAccount) private readonly deleteAccount: DeleteAccount,
    @Inject(RequestPasswordReset) private readonly requestPasswordReset: RequestPasswordReset,
    @Inject(ResetPassword) private readonly resetPassword: ResetPassword,
    @Inject(IS_PRODUCTION) private readonly isProduction: boolean,
  ) {}

  /**
   * Crea una cuenta. **Solo un administrador**: no hay registro abierto, así
   * que quien administra decide quién entra.
   *
   * Vive en identity y no en el panel de administración porque crear usuarios
   * es de este contexto; el panel solo lee.
   */
  @Roles('ADMIN')
  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  // Crear cuentas es caro: cada intento hashea con argon2 y manda un correo.
  @Throttle({ medium: { limit: 5, ttl: 60_000 } })
  async register(@ZodBody(registerSchema) body: RegisterInput): Promise<{ userId: string }> {
    return orThrow(await this.registerUser.execute(body));
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ medium: { limit: 10, ttl: 60_000 } })
  async signIn(
    @ZodBody(loginSchema) body: LoginInput,
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
  async verify(@ZodBody(verifyEmailSchema) body: VerifyEmailInput): Promise<void> {
    orThrow(await this.verifyEmail.execute(body.token));
  }

  /**
   * Manda otra vez el enlace de confirmación.
   *
   * Con sesión y no con el correo en el cuerpo: quien pide el reenvío ya
   * demostró ser el dueño al entrar, y así esto no sirve para averiguar qué
   * direcciones están registradas. Sin cuerpo de respuesta, y responde igual
   * esté confirmada o no la cuenta.
   *
   * Con su propio límite, más estrecho que el general: cada llamada manda un
   * correo, y un botón que se puede apretar cien veces por minuto es un
   * lanzador de spam con la dirección de otro.
   */
  @Throttle({ medium: { limit: 3, ttl: 60_000 } })
  @Post('verify-email/resend')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resend(@CurrentUserId() userId: UserId): Promise<void> {
    orThrow(await this.resendVerification.execute(userId));
  }

  /**
   * Cambia la contraseña de quien ya entró.
   *
   * Cierra todas las sesiones, incluida la de quien la cambia, así que el
   * front tiene que mandar a la pantalla de entrar después de esto.
   */
  @Post('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ medium: { limit: 5, ttl: 60_000 } })
  async changePasswordRoute(
    @CurrentUserId() userId: UserId,
    @ZodBody(changePasswordSchema) body: ChangePasswordInput,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    orThrow(await this.changePassword.execute(userId, body));

    reply.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
  }

  /**
   * Pide el enlace para volver a poner la contraseña.
   *
   * **Responde 204 siempre**, exista la cuenta o no: contestar distinto
   * convertiría esta ruta en un buscador de correos registrados. Con su propio
   * límite, porque cada llamada manda un correo a una dirección que quien
   * llama ni siquiera tiene que ser suya.
   */
  @Public()
  @Post('password/forgot')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ medium: { limit: 3, ttl: 60_000 } })
  async forgotPassword(@ZodBody(forgotPasswordSchema) body: ForgotPasswordInput): Promise<void> {
    await this.requestPasswordReset.execute(body.email);
  }

  @Public()
  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ medium: { limit: 10, ttl: 60_000 } })
  async resetPasswordRoute(@ZodBody(resetPasswordSchema) body: ResetPasswordInput): Promise<void> {
    orThrow(await this.resetPassword.execute(body.token, body.password));
  }

  /*
   * Las tres de administración de cuentas viven acá y no en el panel por lo
   * mismo que `POST /auth/users`: crear, borrar y cambiar la contraseña de una
   * cuenta es de este contexto, y el panel solo lee. Todas exigen el rol.
   */

  @Roles('ADMIN')
  @Post('users/:userId/password')
  async resetAccount(@Param('userId') userId: string): Promise<TemporaryPasswordView> {
    return orThrow(await this.resetAccountPassword.execute(toUserId(userId)));
  }

  @Roles('ADMIN')
  @Patch('users/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async setActive(
    @CurrentUserId() actorId: UserId,
    @Param('userId') userId: string,
    @ZodBody(setAccountActiveSchema) body: SetAccountActiveInput,
  ): Promise<void> {
    orThrow(await this.setAccountActive.execute(actorId, toUserId(userId), body.active));
  }

  @Roles('ADMIN')
  @Delete('users/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeAccount(
    @CurrentUserId() actorId: UserId,
    @Param('userId') userId: string,
  ): Promise<void> {
    orThrow(await this.deleteAccount.execute(actorId, toUserId(userId)));
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
    role: user.role,
  };
}

function toUserId(raw: string): UserId {
  if (!UserId.is(raw)) {
    throw new InvalidInputError('admin.user_id_invalid', 'Ese identificador no vale.');
  }

  return UserId.from(raw);
}
