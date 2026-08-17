import type { Params } from 'nestjs-pino';

/**
 * Campos que jamás deben terminar en un log. La lista se aplica en el logger,
 * no en cada punto de llamada: confiar en que nadie loguee un header de
 * Authorization por descuido no es una estrategia.
 */
const REDACTED = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-telegram-bot-api-secret-token"]',
  'res.headers["set-cookie"]',
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
      // Las dos sondas de salud golpean seguido y no aportan nada al log.
      autoLogging: {
        ignore: (req) => req.url === '/health' || req.url === '/health/ready',
      },
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
