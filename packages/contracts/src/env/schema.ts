import { z } from 'zod';
import { PASSWORD_MIN_LENGTH } from '../identity.js';

/** Un secreto generado con `openssl rand -base64 N` no baja de 32 caracteres. */
const secret = (label: string) =>
  z.string().min(32, `${label} es demasiado corto, genéralo con: openssl rand -base64 48`);

/** Clave de 32 bytes exactos en base64, que es lo que pide AES-256-GCM. */
const aesKey = z.string().refine((value) => Buffer.from(value, 'base64').length === 32, {
  message: 'ENCRYPTION_KEY debe ser 32 bytes en base64. Genérala con: openssl rand -base64 32',
});

/** Acepta 15m, 2h, 30d y también un número plano de segundos. */
const duration = z.string().regex(/^\d+[smhd]?$/, 'Usa un formato como 15m, 24h, 30d o 900');

const port = z.coerce.number().int().min(1).max(65535);

/**
 * Una variable que en el `.env` quedó escrita pero vacía llega como `''`, no
 * como `undefined`, y eso no es lo mismo para un campo opcional. Acá el string
 * vacío se trata como ausencia.
 */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

/**
 * Todo lo que el API necesita del entorno.
 *
 * Estuvo partido en un esquema compartido y uno propio mientras hubo dos
 * procesos. Con uno solo, la partición solo obligaba a mirar en dos sitios para
 * saber si una variable hacía falta.
 */
export const apiEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().startsWith('postgresql://', 'Debe ser una URL de Postgres'),

    STORAGE_ENDPOINT: z.url(),
    STORAGE_REGION: z.string().min(1),
    STORAGE_BUCKET: z.string().min(1),
    STORAGE_ACCESS_KEY: z.string().min(1),
    STORAGE_SECRET_KEY: z.string().min(1),
    STORAGE_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(900),

    ENCRYPTION_KEY: aesKey,

    TELEGRAM_BOT_TOKEN: z
      .string()
      .regex(/^\d{8,10}:[A-Za-z0-9_-]{35}$/, 'No parece un token de @BotFather'),
    TELEGRAM_BOT_USERNAME: z.string().min(1),

    WEB_URL: z.url(),
    API_URL: z.url(),

    /**
     * `log` escribe el enlace de verificación en la consola en vez de mandarlo.
     * Es cómodo en desarrollo y peligroso en cualquier otro lado: ese enlace
     * permite tomar la cuenta. Por eso hay que pedirlo a mano y el valor por
     * defecto es mandar correo de verdad.
     */
    MAIL_TRANSPORT: z.enum(['smtp', 'resend', 'log']).default('smtp'),

    /*
     * SMTP queda como salida, no como camino principal.
     *
     * En un VPS el puerto 25 suele estar bloqueado de fábrica y el 587 a menudo
     * también, así que un correo por SMTP puede no salir nunca sin que nada lo
     * anuncie. Resend va por HTTPS al 443, que no lo bloquea nadie.
     *
     * Por eso el puerto ya no trae el 1025 de Mailpit por defecto: era el de la
     * bandeja de mentira del desarrollo y se colaba en producción demasiado fácil.
     */
    SMTP_HOST: optional(z.string().min(1)),
    SMTP_PORT: port.default(587),
    SMTP_USER: optional(z.string()),
    SMTP_PASSWORD: optional(z.string()),

    RESEND_API_KEY: optional(z.string().min(1)),

    MAIL_FROM: z.email(),

    API_PORT: port.default(3001),

    // Solo el token de acceso se firma. El de refresco son 32 bytes aleatorios
    // guardados como hash en la base, así que no hay nada que firmar y pedir un
    // secreto para eso sería pedir algo que no protege nada.
    JWT_ACCESS_SECRET: secret('JWT_ACCESS_SECRET'),
    JWT_ACCESS_TTL: duration.default('15m'),
    JWT_REFRESH_TTL: duration.default('30d'),

    TELEGRAM_WEBHOOK_SECRET: secret('TELEGRAM_WEBHOOK_SECRET'),
    TELEGRAM_WEBHOOK_URL: optional(z.url()),

    /*
     * La cuenta que administra, resuelta al arrancar.
     *
     * Sin registro abierto, la primera cuenta no la puede crear nadie desde la
     * aplicación: el huevo y la gallina. Con esto, quien despliega deja el correo
     * en el entorno y el API se encarga — si esa cuenta existe la asciende, y si
     * no existe la crea con la contraseña de abajo.
     *
     * Las dos son opcionales: una instalación que ya tiene su administrador no
     * necesita ninguna, y dejarlas puestas no hace daño porque la operación es
     * idempotente.
     */
    ADMIN_EMAIL: optional(z.email()),
    ADMIN_INITIAL_PASSWORD: optional(z.string().min(PASSWORD_MIN_LENGTH)),
  })
  .superRefine((env, ctx) => {
    /*
     * Cada transporte pide lo suyo, y se comprueba al arrancar.
     *
     * Antes `SMTP_HOST` era obligatorio siempre, así que elegir otro transporte
     * seguía exigiendo un servidor SMTP que nadie iba a usar. Y al revés es peor:
     * arrancar sin la clave de Resend deja un servidor que parece sano y no manda
     * ni un correo hasta que alguien intenta registrarse.
     */
    if (env.MAIL_TRANSPORT === 'smtp' && !env.SMTP_HOST) {
      ctx.addIssue({
        code: 'custom',
        path: ['SMTP_HOST'],
        message: 'Con MAIL_TRANSPORT=smtp hace falta SMTP_HOST.',
      });
    }

    if (env.MAIL_TRANSPORT === 'resend' && !env.RESEND_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['RESEND_API_KEY'],
        message: 'Con MAIL_TRANSPORT=resend hace falta RESEND_API_KEY.',
      });
    }
  });

export type ApiEnv = z.infer<typeof apiEnvSchema>;
