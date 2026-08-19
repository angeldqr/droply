import { describe, expect, it } from 'vitest';
import { slotsOf as slotsOfScheduling } from '../../scheduling/domain/daily-slots';
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
  SentBag,
} from '../domain/ports';
import { slotsOf } from '../infrastructure/prisma-delivery.adapters';
import { selectOne, type Candidate, type Randomness } from '../domain/selection';

const TARGET: DispatchTarget = {
  scheduleId: 'horario-1',
  libraryId: 'biblioteca-1',
  ownerId: 'ana',
  chatId: '555',
  senderName: 'Papá',
  strategy: 'RANDOM',
  kindFilter: null,
  startMinute: 8 * 60,
  endMinute: 20 * 60,
  timezone: 'America/Bogota',
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
  candidates: Candidate[] = [{ id: 'foto', position: 1, kind: 'IMAGE' }];

  candidatesOf(): Promise<Candidate[]> {
    return Promise.resolve(this.candidates);
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

class FakeBag implements SentBag {
  ids: string[] = [];
  cleared = 0;

  idsOf(): Promise<string[]> {
    return Promise.resolve(this.ids);
  }

  add(_scheduleId: string, itemId: string): Promise<void> {
    this.ids.push(itemId);

    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.cleared += 1;
    this.ids = [];

    return Promise.resolve();
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

  record(attempt: {
    occurrenceKey: string;
    status: 'SENT' | 'FAILED' | 'SKIPPED';
    error: string | null;
  }): Promise<boolean> {
    this.entries.push({ status: attempt.status, error: attempt.error });

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
const always = (index: number): Randomness => ({ pick: () => index });

function build() {
  const schedules = new FakeSchedules();
  const catalog = new FakeCatalog();
  const bag = new FakeBag();
  const sender = new FakeSender();
  const log = new FakeLog();

  return {
    schedules,
    catalog,
    bag,
    sender,
    log,
    dispatch: new DispatchOccurrence(schedules, catalog, bag, media, sender, log, always(0)),
  };
}

const AHORA = new Date('2026-05-11T13:00:00Z');

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
    world.catalog.candidates = [];

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

describe('estrategias de selección', () => {
  const tres: Candidate[] = [
    { id: 'a', position: 1, kind: 'IMAGE' },
    { id: 'b', position: 2, kind: 'IMAGE' },
    { id: 'c', position: 3, kind: 'IMAGE' },
  ];

  it('en orden sigue las posiciones del tablero', () => {
    const first = selectOne('SEQUENTIAL', tres, new Set(), always(0));
    const second = selectOne('SEQUENTIAL', tres, new Set(['a']), always(0));

    expect(first?.chosen.id).toBe('a');
    expect(second?.chosen.id).toBe('b');
  });

  it('en orden vuelve a empezar al llegar al final', () => {
    const wrapped = selectOne('SEQUENTIAL', tres, new Set(['a', 'b', 'c']), always(0));

    expect(wrapped?.chosen.id).toBe('a');
    expect(wrapped?.resetBag).toBe(true);
  });

  it('sin repetir no elige lo que ya salió', () => {
    // El azar apunta al primero de los pendientes, que con "a" y "b" gastados
    // solo puede ser "c".
    const choice = selectOne('RANDOM_NO_REPEAT', tres, new Set(['a', 'b']), always(0));

    expect(choice?.chosen.id).toBe('c');
    expect(choice?.resetBag).toBe(false);
  });

  it('sin repetir vacía la bolsa cuando ya salió todo', () => {
    const choice = selectOne('RANDOM_NO_REPEAT', tres, new Set(['a', 'b', 'c']), always(1));

    expect(choice?.chosen.id).toBe('b');
    expect(choice?.resetBag).toBe(true);
  });

  it('al azar puede repetir, y por eso no vacía nada', () => {
    const choice = selectOne('RANDOM', tres, new Set(['a', 'b', 'c']), always(2));

    expect(choice?.chosen.id).toBe('c');
    expect(choice?.resetBag).toBe(false);
  });

  it('sin candidatos no elige nada', () => {
    expect(selectOne('RANDOM', [], new Set(), always(0))).toBeNull();
  });
});

describe('el reparto de horas coincide con el del calendario', () => {
  /*
   * Están escritos dos veces porque un contexto no importa del dominio de otro.
   * Si se separaran, el calendario despertaría a una hora en la que el envío no
   * encontraría nada que mandar, y no lo notaría nadie hasta que un destinatario
   * dejara de recibir.
   */
  it('dan lo mismo para los repartos que se usan de verdad', () => {
    for (let times = 1; times <= 12; times += 1) {
      expect(slotsOf(times, 480, 1200)).toEqual(slotsOfScheduling(times, 480, 1200));
    }
  });
});
