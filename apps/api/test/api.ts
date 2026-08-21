import fastifyCookie from '@fastify/cookie';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/platform/prisma/prisma.service';
import { CHANNEL_GATEWAY } from '../src/recipients/domain/ports';
import { MESSAGE_SENDER, type Payload, type SendResult } from '../src/delivery/domain/ports';
import {
  MAILER,
  type PasswordResetMail,
  type VerificationMail,
} from '../src/identity/domain/ports';
import { TelegramConnection } from '../src/recipients/infrastructure/telegram-connection';
import { TEST_SCHEMA, testDatabaseUrl } from './database';

/** Lo que se le habría mandado a Telegram, sin salir de la máquina. */
export class SentMessages {
  readonly sent: { chatId: string; caption: string; payload: Payload }[] = [];

  send(chatId: string, payload: Payload, caption: string): Promise<SendResult> {
    this.sent.push({ chatId, caption, payload });

    return Promise.resolve({ messageId: `mensaje-${this.sent.length}`, failure: null });
  }
}

/** Lo que el bot le contesta a quien abre el enlace. */
export class BotReplies {
  readonly sent: { externalId: string; text: string }[] = [];

  send(externalId: string, text: string): Promise<void> {
    this.sent.push({ externalId, text });

    return Promise.resolve();
  }
}

/**
 * Los correos, con su enlace entero.
 *
 * Es lo que deja probar la verificación de verdad en vez de marcarla a mano en
 * la base: el token viaja en la URL, igual que le llegaría a la persona.
 */
export class Mailbox {
  readonly verifications: VerificationMail[] = [];
  readonly resets: PasswordResetMail[] = [];

  sendVerification(mail: VerificationMail): Promise<void> {
    this.verifications.push(mail);

    return Promise.resolve();
  }

  sendPasswordReset(mail: PasswordResetMail): Promise<void> {
    this.resets.push(mail);

    return Promise.resolve();
  }
}

export interface TestApi {
  readonly app: NestFastifyApplication;
  readonly prisma: PrismaService;
  readonly telegram: SentMessages;
  readonly bot: BotReplies;
  readonly mailbox: Mailbox;
}

/**
 * La aplicación entera, contra la base de pruebas.
 *
 * Solo se dobla lo que sale de la máquina: Telegram y el correo. Todo lo demás
 * —Postgres, argon2, los guards, el filtro de errores, la validación de zod—
 * es el mismo código que corre en el servidor, que es el sentido de probar de
 * extremo a extremo.
 *
 * El limitador sí se desactiva: diez peticiones por segundo es lo correcto de
 * cara a internet y una traba absurda para un test que hace quince seguidas.
 */
export async function startApi(): Promise<TestApi> {
  process.env['DATABASE_URL'] = testDatabaseUrl();
  // Sin esto, cada petición imprime su línea y un fallo queda enterrado.
  process.env['LOG_LEVEL'] ??= 'silent';

  const telegram = new SentMessages();
  const bot = new BotReplies();
  const mailbox = new Mailbox();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MESSAGE_SENDER)
    .useValue(telegram)
    .overrideProvider(CHANNEL_GATEWAY)
    .useValue(bot)
    .overrideProvider(MAILER)
    .useValue(mailbox)
    // Sin esto, arrancar la aplicación llama a api.telegram.org de verdad.
    .overrideProvider(TelegramConnection)
    .useValue({ onApplicationBootstrap: () => undefined, onApplicationShutdown: () => undefined })
    /*
     * El limitador se desarma por donde lleva la cuenta, no por el guard.
     *
     * El guard va montado como global y ni `overrideGuard` ni
     * `overrideProvider` lo alcanzan ahí; los topes tampoco valen, porque cada
     * ruta trae el suyo en su `@Throttle`. Con un almacén que siempre dice «va
     * por la primera» el guard corre entero y nunca bloquea, que es lo que hace
     * falta: crear cuentas admite cinco por minuto y el cuarto caso que se
     * agregara moriría con un 429 sin relación con lo que probaba.
     */
    .overrideProvider(ThrottlerStorage)
    .useValue({
      increment: () =>
        Promise.resolve({ totalHits: 1, timeToExpire: 1, isBlocked: false, timeToBlockExpire: 0 }),
    })
    .compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
    logger: false,
  });

  await app.register(fastifyCookie);
  // El mismo prefijo que pone `main.ts`: sin él las rutas no serían las mismas.
  app.setGlobalPrefix('api', { exclude: ['health', 'health/ready'] });

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return { app, prisma: app.get(PrismaService), telegram, bot, mailbox };
}

/**
 * Vacía las tablas entre casos.
 *
 * `TRUNCATE ... CASCADE` de una sola vez y no un `deleteMany` por tabla: así no
 * hay un orden de borrado que mantener cada vez que aparece una clave foránea.
 */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = ${TEST_SCHEMA} AND tablename <> '_prisma_migrations'
  `;

  if (tables.length === 0) return;

  const names = tables.map((row) => `"${TEST_SCHEMA}"."${row.tablename}"`).join(', ');

  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
}
