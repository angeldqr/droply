import { describe, expect, it } from 'vitest';
import { DispatchOccurrence } from '../application/dispatch-occurrence';
import type {
  DeliveryLog,
  DispatchTarget,
  LibraryCatalog,
  MediaSource,
  MessageSender,
  Payload,
  ScheduleReader,
  SendResult,
} from '../domain/ports';

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

  payloadOf(itemId: string): Promise<Payload | null> {
    return Promise.resolve({
      itemId,
      kind: 'TEXT',
      fileName: null,
      text: 'buenos días',
      storageKey: null,
    });
  }
}

class FakeSender implements MessageSender {
  result: SendResult = { messageId: '1', failure: null };
  sent: { chatId: string; caption: string }[] = [];
  notices: string[] = [];

  send(chatId: string, _payload: Payload, caption: string): Promise<SendResult> {
    this.sent.push({ chatId, caption });

    return Promise.resolve(this.result);
  }

  notifyOwner(_ownerId: string, text: string): Promise<void> {
    this.notices.push(text);

    return Promise.resolve();
  }
}

class FakeLog implements DeliveryLog {
  readonly keys = new Set<string>();
  readonly entries: { status: string; error: string | null }[] = [];
  readonly attempts: { itemId: string | null }[] = [];

  record(attempt: {
    occurrenceKey: string;
    itemId: string | null;
    status: 'SENT' | 'FAILED' | 'SKIPPED';
    error: string | null;
  }): Promise<boolean> {
    this.entries.push({ status: attempt.status, error: attempt.error });
    this.attempts.push({ itemId: attempt.itemId });

    // El índice único de la base, en miniatura: la segunda vez ya estaba.
    if (this.keys.has(attempt.occurrenceKey)) return Promise.resolve(false);

    this.keys.add(attempt.occurrenceKey);

    return Promise.resolve(true);
  }

  recent(): Promise<never[]> {
    return Promise.resolve([]);
  }
}

const media: MediaSource = { bytesOf: () => Promise.resolve(new Uint8Array()) };

function build() {
  const schedules = new FakeSchedules();
  const catalog = new FakeCatalog();
  const sender = new FakeSender();
  const log = new FakeLog();

  return {
    schedules,
    catalog,
    sender,
    log,
    dispatch: new DispatchOccurrence(schedules, catalog, media, sender, log),
  };
}

const AHORA = new Date('2026-05-11T13:00:00Z');

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
    expect(world.log.attempts[0]?.itemId).toBe('el-audio');
  });

  it('a una hora sin nada clavado sale lo que diga el plan', async () => {
    const world = build();
    world.schedules.target = { ...TARGET, fixedItems: [{ minute: 1200, itemId: 'el-audio' }] };

    expect(await world.dispatch.execute('horario-1', AHORA, 'clave-suelta')).toBe('SENT');
    expect(world.log.attempts[0]?.itemId).toBe('foto');
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
    expect(world.log.entries.at(-1)?.error).toBe('nada que enviar');
  });

  it('un fallo permanente apaga el horario y avisa al dueño', async () => {
    const world = build();
    world.sender.result = {
      messageId: null,
      failure: { permanent: true, reason: 'bot was blocked by the user' },
    };

    expect(await world.dispatch.execute('horario-1', AHORA, 'clave-1')).toBe('FAILED');
    expect(world.schedules.deactivated).toEqual(['horario-1']);
    expect(world.sender.notices).toHaveLength(1);
  });

  it('un fallo pasajero no apaga nada: la próxima ocurrencia reintenta', async () => {
    const world = build();
    world.sender.result = {
      messageId: null,
      failure: { permanent: false, reason: 'no se pudo conectar' },
    };

    expect(await world.dispatch.execute('horario-1', AHORA, 'clave-1')).toBe('FAILED');
    expect(world.schedules.deactivated).toEqual([]);
    expect(world.sender.notices).toHaveLength(0);
  });
});
