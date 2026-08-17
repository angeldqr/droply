import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { loadEnv } from './load.js';
import { apiEnvSchema } from './schema.js';

const validEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://droply:secreto@localhost:5432/droply',
  REDIS_URL: 'redis://localhost:6379',
  STORAGE_ENDPOINT: 'http://localhost:9000',
  STORAGE_REGION: 'us-east-1',
  STORAGE_BUCKET: 'droply-media',
  STORAGE_ACCESS_KEY: 'minio-access',
  STORAGE_SECRET_KEY: 'minio-secret',
  ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  TELEGRAM_BOT_TOKEN: `123456789:${'a'.repeat(35)}`,
  TELEGRAM_BOT_USERNAME: 'droply_bot',
  WEB_URL: 'http://localhost:3000',
  API_URL: 'http://localhost:3001',
  JWT_ACCESS_SECRET: 'x'.repeat(48),
  TELEGRAM_WEBHOOK_SECRET: 'z'.repeat(48),
  SMTP_HOST: 'localhost',
  MAIL_FROM: 'no-responder@droply.app',
};

describe('loadEnv', () => {
  it('aplica los valores por defecto de lo opcional', () => {
    const env = loadEnv(apiEnvSchema, validEnv as NodeJS.ProcessEnv);

    expect(env.API_PORT).toBe(3001);
    expect(env.JWT_ACCESS_TTL).toBe('15m');
    expect(env.STORAGE_SIGNED_URL_TTL_SECONDS).toBe(900);
  });

  it('nombra todas las variables que fallan, no solo la primera', () => {
    const broken = { ...validEnv, JWT_ACCESS_SECRET: 'corto', MAIL_FROM: 'no-es-un-mail' };

    // Sin fijar el orden: lo que importa es que estén las dos, no cuál va antes.
    expect(() => loadEnv(apiEnvSchema, broken as NodeJS.ProcessEnv)).toThrowError(
      /JWT_ACCESS_SECRET/,
    );
    expect(() => loadEnv(apiEnvSchema, broken as NodeJS.ProcessEnv)).toThrowError(/MAIL_FROM/);
  });

  it('rechaza una ENCRYPTION_KEY que no sea de 32 bytes', () => {
    const broken = { ...validEnv, ENCRYPTION_KEY: Buffer.alloc(16, 1).toString('base64') };

    expect(() => loadEnv(apiEnvSchema, broken as NodeJS.ProcessEnv)).toThrowError(/32 bytes/);
  });

  it('no filtra el valor del secreto en el mensaje de error', () => {
    const broken = { ...validEnv, JWT_ACCESS_SECRET: 'secreto-filtrado' };

    let message = '';
    try {
      loadEnv(apiEnvSchema, broken as NodeJS.ProcessEnv);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain('JWT_ACCESS_SECRET');
    expect(message).not.toContain('secreto-filtrado');
  });

  it('trata una variable opcional escrita pero vacía como ausente', () => {
    const conVacios = {
      ...validEnv,
      TELEGRAM_WEBHOOK_URL: '',
      SMTP_USER: '',
      SMTP_PASSWORD: '',
    };

    const env = loadEnv(apiEnvSchema, conVacios as NodeJS.ProcessEnv);

    expect(env.TELEGRAM_WEBHOOK_URL).toBeUndefined();
    expect(env.SMTP_USER).toBeUndefined();
  });

  it('rechaza un token de bot con forma inválida', () => {
    const broken = { ...validEnv, TELEGRAM_BOT_TOKEN: 'esto-no-es-un-token' };

    expect(() => loadEnv(apiEnvSchema, broken as NodeJS.ProcessEnv)).toThrowError(/BotFather/);
  });

  it('describe la raíz cuando el valor entero no es un objeto', () => {
    expect(() =>
      loadEnv(z.object({ A: z.string() }), null as unknown as NodeJS.ProcessEnv),
    ).toThrowError(/\(raíz\)/);
  });
});
