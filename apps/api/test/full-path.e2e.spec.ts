import { randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Argon2PasswordHasher } from '../src/identity/infrastructure/argon2-password-hasher';
import type { PrismaService } from '../src/platform/prisma/prisma.service';
import { RunDueSchedules } from '../src/scheduling/application/run-due-schedules';
import { resetDatabase, startApi, type TestApi } from './api';

const ADMIN = { email: 'quien.administra@droply.test', password: 'una-contrasena-larga' };
const ANA = { email: 'ana@droply.test', password: 'otra-contrasena-larga' };
const CHAT = '987654321';

let api: TestApi;

/** La respuesta ya desenvuelta: el estado y el cuerpo, que es lo que se mira. */
async function call(
  app: NestFastifyApplication,
  options: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    url: string;
    token?: string;
    payload?: unknown;
    headers?: Record<string, string>;
  },
): Promise<{ status: number; body: Record<string, never> }> {
  const response = await app.inject({
    method: options.method,
    url: options.url,
    payload: options.payload as never,
    headers: {
      ...options.headers,
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
  });

  return {
    status: response.statusCode,
    body: response.body ? (JSON.parse(response.body) as Record<string, never>) : {},
  };
}

/**
 * El administrador de arranque, puesto directo en la base.
 *
 * Es el único atajo del recorrido, y no tiene otro remedio: crear cuentas exige
 * ser administrador, así que el primero no puede salir de la propia API. Es lo
 * mismo que hace el script de arranque en el servidor.
 */
async function seedAdmin(prisma: PrismaService): Promise<void> {
  await prisma.user.create({
    data: {
      id: randomUUID(),
      email: ADMIN.email,
      role: 'ADMIN',
      passwordHash: await new Argon2PasswordHasher().hash(ADMIN.password),
      displayName: 'Quien administra',
      timezone: 'America/Bogota',
      emailVerifiedAt: new Date(),
    },
  });
}

async function tokenOf(email: string, password: string): Promise<string> {
  const signed = await call(api.app, {
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password },
  });

  expect(signed.status).toBe(200);

  return String(signed.body['accessToken']);
}

/**
 * Todo el camino hasta tener un horario listo para disparar.
 *
 * Cuenta creada por quien administra, correo confirmado con el token que viajó
 * en el enlace, biblioteca con un texto, destinatario que abrió su enlace por
 * el webhook, y el horario apuntando a los dos.
 */
async function armarTodo(): Promise<{ scheduleId: string; anaToken: string }> {
  await seedAdmin(api.prisma);
  const adminToken = await tokenOf(ADMIN.email, ADMIN.password);

  const created = await call(api.app, {
    method: 'POST',
    url: '/api/auth/users',
    token: adminToken,
    payload: {
      email: ANA.email,
      password: ANA.password,
      displayName: 'Ana',
      timezone: 'America/Bogota',
    },
  });

  expect(created.status).toBe(201);

  const mail = api.mailbox.verifications.at(-1);

  expect(String(mail?.to)).toBe(ANA.email);

  const verified = await call(api.app, {
    method: 'POST',
    url: '/api/auth/verify-email',
    payload: { token: new URL(mail?.verificationUrl ?? '').searchParams.get('token') },
  });

  expect(verified.status).toBe(204);

  const anaToken = await tokenOf(ANA.email, ANA.password);

  const library = await call(api.app, {
    method: 'POST',
    url: '/api/libraries',
    token: anaToken,
    payload: { name: 'Buenos días' },
  });

  expect(library.status).toBe(201);

  const item = await call(api.app, {
    method: 'POST',
    url: `/api/libraries/${String(library.body['id'])}/items/text`,
    token: anaToken,
    payload: { text: 'Que tengas un buen día.' },
  });

  expect(item.status).toBe(201);

  const recipient = await call(api.app, {
    method: 'POST',
    url: '/api/recipients',
    token: anaToken,
    payload: { label: 'Mamá' },
  });

  expect(recipient.status).toBe(201);
  expect(recipient.body['status']).toBe('PENDING');

  // Esa persona abre el enlace. Entra por la misma puerta que usaría Telegram,
  // con su secreto: si el guard del webhook estuviera mal, se vería acá.
  const code = new URL(String(recipient.body['linkUrl'])).searchParams.get('start');

  await call(api.app, {
    method: 'POST',
    url: '/api/telegram/webhook',
    headers: { 'x-telegram-bot-api-secret-token': process.env['TELEGRAM_WEBHOOK_SECRET'] ?? '' },
    payload: { message: { chat: { id: Number(CHAT) }, text: `/start ${code}` } },
  });

  expect(api.bot.sent.at(-1)?.text).toContain('Ya puedes recibir envíos');

  const allowed = await call(api.app, {
    method: 'PUT',
    url: `/api/libraries/${String(library.body['id'])}/recipients`,
    token: anaToken,
    payload: { recipientIds: [recipient.body['id']] },
  });

  expect(allowed.status).toBe(200);

  const schedule = await call(api.app, {
    method: 'POST',
    url: '/api/schedules',
    token: anaToken,
    payload: {
      libraryId: library.body['id'],
      recipientId: recipient.body['id'],
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      startMinute: 6 * 60,
      endMinute: 21 * 60,
      timezone: 'America/Bogota',
    },
  });

  expect(schedule.status).toBe(201);

  return { scheduleId: String(schedule.body['id']), anaToken };
}

/**
 * Las seis de la mañana de ayer en Bogotá, que en UTC son las once.
 *
 * No vale cualquier instante pasado: con un solo archivo que sale una vez al
 * día, el plan tiene un único envío y cae en el inicio de la franja. Vencer el
 * horario a las ocho de la noche lo despertaría a una hora que no le toca a
 * nadie, y no saldría nada — que es justo lo que debe pasar.
 *
 * Colombia no cambia la hora, así que la resta es fija.
 */
function ayerALasSeis(): Date {
  const at = new Date();
  at.setUTCDate(at.getUTCDate() - 1);
  at.setUTCHours(11, 0, 0, 0);

  return at;
}

/**
 * Adelanta la hora del horario en vez de esperar a mañana.
 *
 * Es lo único que se toca a mano en toda la prueba, y no hay forma de evitarlo
 * sin un reloj de mentira: el resto del latido corre tal cual, con su consulta,
 * su bloqueo y su reparto.
 */
async function vencer(scheduleId: string, at: Date): Promise<void> {
  await api.prisma.schedule.update({ where: { id: scheduleId }, data: { nextRunAt: at } });
}

beforeAll(async () => {
  api = await startApi();
}, 60_000);

afterAll(async () => {
  await api.app.close();
});

beforeEach(async () => {
  await resetDatabase(api.prisma);
  api.telegram.sent.length = 0;
  api.bot.sent.length = 0;
  api.mailbox.verifications.length = 0;
});

/**
 * El recorrido entero, con la aplicación de verdad y Postgres de verdad.
 *
 * Los tests de casos de uso prueban cada pieza contra dobles; este prueba que
 * las piezas encajen: que el guard deje pasar el token que emite el login, que
 * zod acepte lo que manda el front, que Prisma guarde lo que el dominio dice,
 * que el latido encuentre lo que el horario dejó y que al final salga un
 * mensaje. Nada de eso lo puede ver un test con dobles — el envío de las seis
 * de la mañana falló justamente por una diferencia entre lo que el dominio creía
 * y lo que Postgres hacía con las fechas.
 *
 * Solo se dobla lo que sale de la máquina: Telegram y el correo.
 */
describe('de crear la cuenta a que salga el mensaje', () => {
  it('recorre el camino completo y manda el texto al chat vinculado', async () => {
    const { scheduleId } = await armarTodo();

    await vencer(scheduleId, ayerALasSeis());

    const due = await api.app.get(RunDueSchedules).execute();

    expect(due).toHaveLength(1);

    expect(api.telegram.sent).toHaveLength(1);
    expect(api.telegram.sent[0]?.chatId).toBe(CHAT);
    // El remitente va en el propio mensaje: quien recibe tiene un chat con un
    // bot, no con una persona.
    expect(api.telegram.sent[0]?.caption).toBe('De Ana');
    expect(api.telegram.sent[0]?.payload.text).toBe('Que tengas un buen día.');

    const attempts = await api.prisma.deliveryAttempt.findMany();

    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.status).toBe('SENT');
    expect(attempts[0]?.providerMessageId).toBe('mensaje-1');
  });

  it('la misma ocurrencia dos veces no llega dos veces al chat', async () => {
    const { scheduleId } = await armarTodo();
    const occurredAt = ayerALasSeis();

    await vencer(scheduleId, occurredAt);
    await api.app.get(RunDueSchedules).execute();

    // La misma hora exacta otra vez: es lo que pasaría si dos réplicas
    // atendieran el mismo minuto, o si el proceso muriera después de enviar y
    // el horario quedara sin adelantar.
    await vencer(scheduleId, occurredAt);
    await api.app.get(RunDueSchedules).execute();

    expect(api.telegram.sent).toHaveLength(1);
    expect(await api.prisma.deliveryAttempt.count()).toBe(1);
  });

  it('un horario apagado no despierta al latido', async () => {
    const { scheduleId, anaToken } = await armarTodo();

    const paused = await call(api.app, {
      method: 'PATCH',
      url: `/api/schedules/${scheduleId}`,
      token: anaToken,
      payload: { active: false },
    });

    expect(paused.status).toBe(200);

    await vencer(scheduleId, ayerALasSeis());

    expect(await api.app.get(RunDueSchedules).execute()).toHaveLength(0);
    expect(api.telegram.sent).toHaveLength(0);
  });
});
