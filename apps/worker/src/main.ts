import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { loadDotenv } from './platform/config/load-dotenv';

/**
 * El worker no expone HTTP: es un proceso que consume colas. Los hooks de
 * apagado dejan que BullMQ termine el job en curso antes de morir, en vez de
 * cortar un envío por la mitad.
 */
async function bootstrap(): Promise<void> {
  loadDotenv();

  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  await app.init();
}

void bootstrap();
