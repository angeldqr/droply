import { z } from 'zod';

/**
 * Los límites de la contraseña, para el borde HTTP y para el front.
 *
 * El dominio los repite en `PlainPassword` en vez de importarlos de acá,
 * porque el núcleo no depende de ningún paquete externo. Que no se separen lo
 * cuida un test en `apps/api/src/identity/domain/password.spec.ts`, que falla
 * si los números dejan de coincidir.
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 200;

export const timezoneSchema = z.string().refine(
  (value) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Elegí una zona horaria válida.' },
);

export const registerSchema = z.object({
  email: z.email('Ese correo no tiene forma de correo.'),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Necesita al menos ${PASSWORD_MIN_LENGTH} caracteres.`)
    .max(PASSWORD_MAX_LENGTH),
  displayName: z.string().trim().min(2, 'Poné al menos dos caracteres.').max(80),
  timezone: timezoneSchema,
});

export const loginSchema = z.object({
  // El tope importa más acá que en el registro: login es el único endpoint sin
  // autenticar donde argon2 corre en cada intento, y argon2 procesa la entrada
  // entera. Sin techo, un cuerpo de varios megas ocupa la CPU del servidor.
  email: z.email().max(254),
  password: z.string().min(1, 'Escribí tu contraseña.').max(PASSWORD_MAX_LENGTH),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

/** Lo que devuelve el API tras un login o un refresco. */
export interface SessionResponse {
  readonly accessToken: string;
  readonly expiresInSeconds: number;
  readonly user: AuthenticatedUser;
}

export interface AuthenticatedUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly timezone: string;
  readonly emailVerified: boolean;
}
