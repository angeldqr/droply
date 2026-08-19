import 'reflect-metadata';
import fastifyCookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { ENV, type ApiEnv } from './platform/config/env.module';
import { loadDotenv } from './platform/config/load-dotenv';

async function bootstrap(): Promise<void> {
  // Antes de construir nada: el módulo de entorno valida contra `process.env`.
  loadDotenv();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true, bodyLimit: 1_048_576 }),
    { bufferLogs: true },
  );

  app.useLogger(app.get(Logger));

  const env = app.get<ApiEnv>(ENV);
  const isProduction = env.NODE_ENV === 'production';

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", env.STORAGE_ENDPOINT],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    // Las respuestas del API solo las puede leer el front del mismo sitio.
    crossOriginResourcePolicy: { policy: 'same-site' },
  });

  await app.register(fastifyCookie);

  // Solo el front declarado puede llamar al API, y con credenciales para que
  // viaje la cookie de refresh.
  app.enableCors({
    origin: [env.WEB_URL],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  app.setGlobalPrefix('api', { exclude: ['health', 'health/ready'] });
  app.enableShutdownHooks();

  await app.listen({ port: env.API_PORT, host: isProduction ? '0.0.0.0' : '127.0.0.1' });
}

void bootstrap();
