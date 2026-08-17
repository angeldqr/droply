import type { Params } from 'nestjs-pino';

const REDACTED = [
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.secret',
  '*.botToken',
  '*.encryptionKey',
];

export function loggerConfig(isDevelopment: boolean): Params {
  return {
    pinoHttp: {
      level: isDevelopment ? 'debug' : 'info',
      redact: { paths: REDACTED, censor: '[oculto]' },
      ...(isDevelopment
        ? {
            transport: {
              target: 'pino-pretty',
              options: { singleLine: true, translateTime: 'HH:MM:ss' },
            },
          }
        : {}),
    },
  };
}
