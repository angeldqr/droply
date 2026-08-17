import { z } from 'zod';

/** Un secreto generado con `openssl rand -base64 N` no baja de 32 caracteres. */
const secret = (label: string) =>
  z.string().min(32, `${label} es demasiado corto, generalo con: openssl rand -base64 48`);

/** Clave de 32 bytes exactos en base64, que es lo que pide AES-256-GCM. */
const aesKey = z.string().refine((value) => Buffer.from(value, 'base64').length === 32, {
  message: 'ENCRYPTION_KEY debe ser 32 bytes en base64. Generala con: openssl rand -base64 32',
});

/** Acepta 15m, 2h, 30d y también un número plano de segundos. */
const duration = z.string().regex(/^\d+[smhd]?$/, 'Usá un formato como 15m, 24h, 30d o 900');

const port = z.coerce.number().int().min(1).max(65535);

/**
 * Una variable que en el `.env` quedó escrita pero vacía llega como `''`, no
 * como `undefined`, y eso no es lo mismo para un campo opcional. Acá el string
 * vacío se trata como ausencia.
 */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

export const sharedEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().startsWith('postgresql://', 'Debe ser una URL de Postgres'),
  REDIS_URL: z.string().startsWith('redis://', 'Debe ser una URL de Redis'),

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
});

/** Las dos apps mandan correo, así que comparten estas cinco variables. */
const mailEnv = {
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: port.default(1025),
  SMTP_USER: optional(z.string()),
  SMTP_PASSWORD: optional(z.string()),
  MAIL_FROM: z.email(),
};

export const apiEnvSchema = sharedEnvSchema.extend({
  ...mailEnv,

  API_PORT: port.default(3001),

  JWT_ACCESS_SECRET: secret('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: secret('JWT_REFRESH_SECRET'),
  JWT_ACCESS_TTL: duration.default('15m'),
  JWT_REFRESH_TTL: duration.default('30d'),

  TELEGRAM_WEBHOOK_SECRET: secret('TELEGRAM_WEBHOOK_SECRET'),
  TELEGRAM_WEBHOOK_URL: optional(z.url()),
});

export const workerEnvSchema = sharedEnvSchema.extend({
  ...mailEnv,
});

export type SharedEnv = z.infer<typeof sharedEnvSchema>;
export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;
