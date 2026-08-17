import { z } from 'zod';

/**
 * El largo mínimo se define acá y lo respetan los dos lados: el front avisa
 * mientras se escribe, el dominio vuelve a comprobarlo antes de guardar. Que
 * el número viva en un solo lugar evita que se separen.
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
  email: z.email(),
  password: z.string().min(1, 'Escribí tu contraseña.'),
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
