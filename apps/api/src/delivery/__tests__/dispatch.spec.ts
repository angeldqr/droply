import { describe, expect, it } from 'vitest';
import { FixedClock } from '../../shared/clock';
import { DispatchOccurrence, MAX_PER_DAY } from '../application/dispatch-occurrence';
import type {
  DeliveryLog,
  DispatchTarget,
  LibraryCatalog,
  MediaSource,
  MessageSender,
  Payload,
  NoticeWriter,
  ScheduleReader,
  SendResult,
} from '../domain/ports';
import type { DeliveryStatus } from '../domain/vocabulary';

const TARGET: DispatchTarget = {
  scheduleId: 'horario-1',
  libraryId: 'biblioteca-1',
  ownerId: 'ana',
  chatId: '555',
  senderName: 'Papá',
  kindFilter: null,
  startMinute: 8 * 60,
  endMinute: 20 * 60,
  timezone: 'America/Bogota',
  fixedItems: [],
};

class FakeSchedules implements ScheduleReader {
  target: DispatchTarget | null = TARGET;
  deactivated: string[] = [];

  find(): Promise<DispatchTarget | null> {
    return Promise.resolve(this.target);
  }

  deactivate(scheduleId: string): Promise<void> {
    this.deactivated.push(scheduleId);

    return Promise.resolve();
  }
}

class FakeCatalog implements LibraryCatalog {
  /** A quién le toca cuando la hora no está clavada. */
  planned: string | null = 'foto';

  /**
   * El minuto local se resuelve igual que en el de verdad: lo clavado manda
   * sobre el plan. Bogotá es UTC-5 todo el año, así que acá basta la resta.
   */
  itemAt(target: DispatchTarget, occurredAt: Date): Promise<string | null> {
    const minute = ((occurredAt.getUTCHours() + 19) % 24) * 60 + occurredAt.getUTCMinutes();
    const pinned = target.fixedItems.find((fixed) => fixed.minute === minute);

    return Promise.resolve(pinned?.itemId ?? this.planned);
  }

  /** Un texto por defecto, que no necesita bajar bytes de ningún lado. */
  payload: Payload | null = null;

  payloadOf(itemId: string): Promise<Payload | null> {
    return Promise.resolve(
      this.payload ?? {
        itemId,
        kind: 'TEXT',
        fileName: null,
        text: 'buenos días',
        storageKey: null,
      },
    );
  }
}

class FakeSender implements MessageSender {
  result: SendResult = { messageId: '1', failure: null };
  sent: { chatId: string; caption: string }[] = [];

  send(chatId: string, _payload: Payload, caption: string): Promise<SendResult> {
    this.sent.push({ chatId, caption });

    return Promise.resolve(this.result);
  }
}

class FakeNotices implements NoticeWriter {
  readonly written: string[] = [];

  write(_ownerId: string, text: string): Promise<void> {
    this.written.push(text);

    return Promise.resolve();
  }
}

/** Una fila de `delivery_attempts`, con lo que los tests miran de ella. */
interface Row {
  status: DeliveryStatus;
  itemId: string | null;
  error: string | null;
  retryCount: number;
  nextAttemptAt: Date | null;
}

class FakeLog implements DeliveryLog {
  readonly rows = new Map<string, Row>();

  reserve(attempt: {
    occurrenceKey: string;
    itemId: string | null;
    status: DeliveryStatus;
    error: string | null;
  }): Promise<boolean> {
    // El índice único de la base, en miniatura: si ya estaba, no se toca.
    if (this.rows.has(attempt.occurrenceKey)) return Promise.resolve(false);

    this.rows.set(attempt.occurrenceKey, {
      status: attempt.status,
      itemId: attempt.itemId,
      error: attempt.error,
      retryCount: 0,
      nextAttemptAt: null,
    });

    return Promise.resolve(true);
  }

  settle(
    occurrenceKey: string,
    result: {
      status: DeliveryStatus;
      itemId?: string | null;
      error: string | null;
      retryCount?: number;
      nextAttemptAt?: Date | null;
    },
  ): Promise<void> {
    const row = this.rows.get(occurrenceKey);

    if (!row) throw new Error(`se resolvió una ocurrencia sin reservar: ${occurrenceKey}`);

    this.rows.set(occurrenceKey, {
      ...row,
      status: result.status,
      error: result.error,
      ...(result.itemId === undefined ? {} : { itemId: result.itemId }),
      ...(result.retryCount === undefined ? {} : { retryCount: result.retryCount }),
      ...(result.nextAttemptAt === undefined ? {} : { nextAttemptAt: result.nextAttemptAt }),
    });

    return Promise.resolve();
  }

  /**
   * Lo que la cuenta ya llevaba enviado antes del test.
   *
   * Se pone a mano porque llegar al tope enviando de verdad pediría quinientas
   * vueltas; lo que salga durante el test sí se cuenta de las filas, para que
   * la comparación se pruebe de verdad y no contra un número congelado.
   */
  priorSent = 0;

  countSentSince(): Promise<number> {
    const sent = [...this.rows.values()].filter((row) => row.status === 'SENT');

    return Promise.resolve(this.priorSent + sent.length);
  }

  claimDueRetries(): Promise<never[]> {
    return Promise.resolve([]);
  }

  recent(): Promise<never[]> {
    return Promise.resolve([]);
  }

  /** La única fila que los tests usan, porque casi todos despachan una. */
  only(): Row {
    const [row] = [...this.rows.values()];

    if (!row) throw new Error('no se anotó ninguna ocurrencia');

    return row;
  }
}

/** El almacenamiento, que se puede poner de mal humor. */
class FakeMedia implements MediaSource {
  falla = false;

  bytesOf(): Promise<Uint8Array> {
    if (this.falla) return Promise.reject(new Error('MinIO no responde'));

    return Promise.resolve(new Uint8Array());
  }
}

const AHORA = new Date('2026-05-11T13:00:00Z');

function build() {
  const schedules = new FakeSchedules();
  const catalog = new FakeCatalog();
  const sender = new FakeSender();
  const log = new FakeLog();
  const media = new FakeMedia();
  const notices = new FakeNotices();
  const clock = new FixedClock(AHORA);

  return {
    schedules,
    catalog,
    sender,
    log,
    media,
    notices,
    clock,
    dispatch: new DispatchOccurrence(schedules, catalog, media, sender, log, notices, clock),
  };
}

/**
 * Hay cosas que no se dejan al reparto. "El buenos días de las 6" es siempre el
 * mismo audio, y a la hora que el reparto le tocara no sería el de las 6.
 */
describe('envío clavado a una hora', () => {
  /** Las 13:00 UTC son las 8:00 en Bogotá, o sea el minuto 480. */
  const CLAVADO = { ...TARGET, fixedItems: [{ minute: 480, itemId: 'el-audio' }] };

  it('sale lo clavado y no lo que dice el plan', async () => {
    const world = build();
    world.schedules.target = CLAVADO;

    expect(await world.dispatch.execute('horario-1', AHORA, 'clave-fija')).toBe('SENT');
    expect(world.log.only().itemId).toBe('el-audio');
  });

  it('a una hora sin nada clavado sale lo que diga el plan', async () => {
    const world = build();
    world.schedules.target = { ...TARGET, fixedItems: [{ minute: 1200, itemId: 'el-audio' }] };

    expect(await world.dispatch.execute('horario-1', AHORA, 'clave-suelta')).toBe('SENT');
    expect(world.log.only().itemId).toBe('foto');
  });
});

describe('despacho de un envío', () => {
  it('manda y lo deja anotado', async () => {
    const world = build();

    expect(await world.dispatch.execute('horario-1', AHORA, 'clave-1')).toBe('SENT');
    expect(world.sender.sent).toHaveLength(1);
    expect(world.sender.sent[0]?.chatId).toBe('555');
    // El remitente viaja en el mensaje: quien recibe habla con un bot, no con
    // una persona, así que sin esto no sabría de quién le llegó.
    expect(world.sender.sent[0]?.caption).toContain('Papá');
  });

  it('la misma ocurrencia dos veces no manda dos veces', async () => {
    const world = build();

    await world.dispatch.execute('horario-1', AHORA, 'clave-1');
    const second = await world.dispatch.execute('horario-1', AHORA, 'clave-1');

    expect(second).toBe('DUPLICATE');
    expect(world.sender.sent).toHaveLength(1);
  });

  it('no manda nada si el destinatario dejó de estar vinculado', async () => {
    const world = build();
    world.schedules.target = { ...TARGET, chatId: null };

    expect(await world.dispatch.execute('horario-1', AHORA, 'clave-1')).toBe('NOT_LINKED');
    expect(world.sender.sent).toHaveLength(0);
  });

  it('con la biblioteca vacía no manda nada y lo deja dicho', async () => {
    const world = build();
    world.catalog.planned = null;

    expect(await world.dispatch.execute('horario-1', AHORA, 'clave-1')).toBe('NOTHING_TO_SEND');
    expect(world.log.only().error).toBe('nada que enviar');
  });

  it('un fallo permanente apaga el horario y avisa al dueño', async () => {
    const world = build();
    world.sender.result = {
      messageId: null,
      failure: { permanent: true, reason: 'bot was blocked by the user' },
    };

    expect(await world.dispatch.execute('horario-1', AHORA, 'clave-1')).toBe('FAILED');
    expect(world.schedules.deactivated).toEqual(['horario-1']);
    expect(world.notices.written).toHaveLength(1);
  });

  it('un fallo pasajero no apaga nada: queda esperando su reintento', async () => {
    const world = build();
    world.sender.result = {
      messageId: null,
      failure: { permanent: false, reason: 'no se pudo conectar' },
    };

    expect(await world.dispatch.execute('horario-1', AHORA, 'clave-1')).toBe('RETRYING');
    expect(world.schedules.deactivated).toEqual([]);
    expect(world.notices.written).toHaveLength(0);
  });
});

/**
 * Un bache de red no puede costar un envío. Antes lo costaba: el intento
 * quedaba `FAILED` y esa ocurrencia no volvía nunca.
 */
describe('reintentos con espera creciente', () => {
  /** Deja el envío fallando por algo pasajero. */
  function conFalloPasajero() {
    const world = build();

    world.sender.result = {
      messageId: null,
      failure: { permanent: false, reason: 'no se pudo conectar' },
    };

    return world;
  }

  it('el primero espera un minuto', async () => {
    const world = conFalloPasajero();

    await world.dispatch.execute('horario-1', AHORA, 'clave-1');

    const row = world.log.only();

    expect(row.status).toBe('RETRYING');
    expect(row.retryCount).toBe(1);
    expect(row.nextAttemptAt?.toISOString()).toBe('2026-05-11T13:01:00.000Z');
  });

  it('las esperas crecen: uno, cinco y veinticinco minutos', async () => {
    const world = conFalloPasajero();
    const esperas: (string | undefined)[] = [];

    await world.dispatch.execute('horario-1', AHORA, 'clave-1');
    esperas.push(world.log.only().nextAttemptAt?.toISOString());

    for (const intento of [1, 2]) {
      await world.dispatch.retry({
        scheduleId: 'horario-1',
        occurrenceKey: 'clave-1',
        occurredAt: AHORA,
        retryCount: intento,
        itemId: 'foto',
      });
      esperas.push(world.log.only().nextAttemptAt?.toISOString());
    }

    expect(esperas).toEqual([
      '2026-05-11T13:01:00.000Z',
      '2026-05-11T13:05:00.000Z',
      '2026-05-11T13:25:00.000Z',
    ]);
  });

  it('al cuarto intento se rinde, lo dice y avisa', async () => {
    const world = conFalloPasajero();

    await world.dispatch.execute('horario-1', AHORA, 'clave-1');

    const outcome = await world.dispatch.retry({
      scheduleId: 'horario-1',
      occurrenceKey: 'clave-1',
      occurredAt: AHORA,
      retryCount: 3,
      itemId: 'foto',
    });

    expect(outcome).toBe('FAILED');
    expect(world.log.only().status).toBe('FAILED');
    expect(world.log.only().error).toContain('3 reintentos');
    // El dueño se entera dentro de la aplicación, que es el único sitio donde
    // se le puede avisar sin escribirle al chat de otra persona.
    expect(world.notices.written).toHaveLength(1);
  });

  it('un reintento que sale bien deja la ocurrencia enviada y sin hora', async () => {
    const world = conFalloPasajero();

    await world.dispatch.execute('horario-1', AHORA, 'clave-1');

    world.sender.result = { messageId: '42', failure: null };

    const outcome = await world.dispatch.retry({
      scheduleId: 'horario-1',
      occurrenceKey: 'clave-1',
      occurredAt: AHORA,
      retryCount: 1,
      itemId: 'foto',
    });

    expect(outcome).toBe('SENT');
    expect(world.log.only().status).toBe('SENT');
    expect(world.log.only().nextAttemptAt).toBeNull();
  });

  it('deja una sola fila para la ocurrencia, pase lo que pase', async () => {
    const world = conFalloPasajero();

    await world.dispatch.execute('horario-1', AHORA, 'clave-1');
    await world.dispatch.retry({
      scheduleId: 'horario-1',
      occurrenceKey: 'clave-1',
      occurredAt: AHORA,
      retryCount: 1,
      itemId: 'foto',
    });

    /*
     * Es lo que hace que el historial siga siendo legible y que la clave de
     * idempotencia siga sirviendo: un reintento actualiza su fila, no crea otra.
     */
    expect(world.log.rows.size).toBe(1);
  });

  it('el almacenamiento caído también se reintenta', async () => {
    const world = build();

    world.catalog.payload = {
      itemId: 'foto',
      kind: 'IMAGE',
      fileName: 'foto.jpg',
      text: null,
      storageKey: 'ana/biblioteca/foto',
    };
    world.media.falla = true;

    expect(await world.dispatch.execute('horario-1', AHORA, 'clave-1')).toBe('RETRYING');
    expect(world.log.only().error).toBe('no se pudo leer el archivo');
    // No se llegó a hablar con Telegram, así que no hay nada enviado.
    expect(world.sender.sent).toHaveLength(0);
  });

  it('un reintento manda el mismo elemento que se eligió, no el que toque ahora', async () => {
    const world = conFalloPasajero();

    await world.dispatch.execute('horario-1', AHORA, 'clave-1');

    // El plan cambió entre medias porque alguien agregó un archivo.
    world.catalog.planned = 'otra-cosa';
    world.sender.result = { messageId: '42', failure: null };

    await world.dispatch.retry({
      scheduleId: 'horario-1',
      occurrenceKey: 'clave-1',
      occurredAt: AHORA,
      retryCount: 1,
      itemId: 'foto',
    });

    expect(world.log.only().itemId).toBe('foto');
  });

  it('pasado el tope diario no sale nada y queda dicho en el historial', async () => {
    const world = build();
    world.log.priorSent = MAX_PER_DAY;

    expect(await world.dispatch.execute('horario-1', AHORA, 'clave-1')).toBe('OVER_DAILY_LIMIT');
    expect(world.sender.sent).toHaveLength(0);
    expect(world.log.only().status).toBe('SKIPPED');
    expect(world.log.only().error).toBe('tope diario de envíos alcanzado');
  });

  it('el que hace el número quinientos sale, y el siguiente ya no', async () => {
    const world = build();
    world.log.priorSent = MAX_PER_DAY - 1;

    expect(await world.dispatch.execute('horario-1', AHORA, 'clave-1')).toBe('SENT');
    expect(await world.dispatch.execute('horario-1', AHORA, 'clave-2')).toBe('OVER_DAILY_LIMIT');

    // Y lo saltado no engorda la cuenta: si contara, una cuenta que tocó el
    // tope una vez no volvería a enviar nunca.
    expect(await world.dispatch.execute('horario-1', AHORA, 'clave-3')).toBe('OVER_DAILY_LIMIT');
    expect(world.sender.sent).toHaveLength(1);
  });

  it('un reintento no vuelve a pagar el tope diario', async () => {
    const world = conFalloPasajero();

    await world.dispatch.execute('horario-1', AHORA, 'clave-1');

    // La cuenta se pasó del tope mientras esta ocurrencia esperaba. Ya estaba
    // reservada, así que sale igual: cobrársela otra vez sería castigar dos
    // veces el mismo envío por un fallo de red.
    world.log.priorSent = MAX_PER_DAY;
    world.sender.result = { messageId: '42', failure: null };

    const outcome = await world.dispatch.retry({
      scheduleId: 'horario-1',
      occurrenceKey: 'clave-1',
      occurredAt: AHORA,
      retryCount: 1,
      itemId: 'foto',
    });

    expect(outcome).toBe('SENT');
  });
});
