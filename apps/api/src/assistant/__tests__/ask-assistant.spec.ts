import { assistantChatSchema } from '@reconectate/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AssistantSource } from '../../shared/assistant-source';
import { FixedClock } from '../../shared/clock';
import { UserId } from '../../shared/identifiers';
import {
  ASSISTANT_DAILY_LIMIT,
  AskAssistant,
  AssistantDailyLimit,
  AssistantUnavailable,
  inWords,
  type AssistantSources,
} from '../application/ask-assistant';
import type { AssistantModel, AssistantRequest } from '../domain/ports';

const ANA = UserId.from('11111111-1111-4111-8111-111111111111');
const PLAN_AJENO = '99999999-9999-4999-8999-999999999999';

/** Una fuente que anota de quién le pidieron leer. */
class RecordingSource implements AssistantSource {
  readonly owners: string[] = [];

  list(ownerId: UserId): Promise<unknown> {
    this.owners.push(ownerId);
    return Promise.resolve([]);
  }

  detail(ownerId: UserId): Promise<unknown> {
    this.owners.push(ownerId);
    // Lo de otra cuenta no existe: es lo que devuelven las fuentes de verdad.
    return Promise.resolve(null);
  }
}

class FakeModel implements AssistantModel {
  last: AssistantRequest | undefined;

  answer(request: AssistantRequest): Response {
    this.last = request;
    return new Response('ok');
  }
}

const PREGUNTA = [{ role: 'user', text: '¿Cómo voy en mi plan?' }] as const;

let model: FakeModel;
let sources: Record<keyof AssistantSources, RecordingSource>;
let ask: AskAssistant;

beforeEach(() => {
  model = new FakeModel();
  sources = {
    habitPlans: new RecordingSource(),
    journal: new RecordingSource(),
    libraries: new RecordingSource(),
    recipients: new RecordingSource(),
    schedules: new RecordingSource(),
    deliveries: new RecordingSource(),
  };
  ask = new AskAssistant(
    model,
    sources,
    { profileOf: () => Promise.resolve({ name: 'Ana', timezone: 'America/Bogota' }) },
    new FixedClock(new Date('2026-05-11T16:00:00.000Z')),
  );
});

describe('el asistente', () => {
  it('cada lectura va con la cuenta de la sesión, pida lo que pida el modelo', async () => {
    await ask.execute(ANA, PREGUNTA);

    for (const tool of model.last?.tools ?? []) {
      await tool.run(PLAN_AJENO);
    }

    const owners = Object.values(sources).flatMap((source) => source.owners);

    expect(owners.length).toBe(model.last?.tools.length);
    expect(new Set(owners)).toEqual(new Set([ANA]));
  });

  it('ninguna lectura le deja al modelo elegir de quién', async () => {
    await ask.execute(ANA, PREGUNTA);

    for (const tool of model.last?.tools ?? []) {
      expect(tool.idDescription ?? '').not.toMatch(/usuario|cuenta|dueño/i);
    }
  });

  it('un plan ajeno se responde como inexistente', async () => {
    await ask.execute(ANA, PREGUNTA);

    const detalle = model.last?.tools.find((tool) => tool.name === 'detalle_plan');

    expect(await detalle?.run(PLAN_AJENO)).toEqual({ error: 'No existe en esta cuenta.' });
  });

  it('le dice al modelo quién pregunta y qué día es en su zona', async () => {
    await ask.execute(ANA, PREGUNTA);

    expect(model.last?.context).toContain('Ana');
    expect(model.last?.context).toContain('11 de mayo de 2026');
  });

  it(`pasadas ${ASSISTANT_DAILY_LIMIT} preguntas en el día, no responde más`, async () => {
    for (let i = 0; i < ASSISTANT_DAILY_LIMIT; i++) {
      expect((await ask.execute(ANA, PREGUNTA)).ok).toBe(true);
    }

    const result = await ask.execute(ANA, PREGUNTA);

    expect(result.ok ? null : result.error).toBeInstanceOf(AssistantDailyLimit);
  });

  it('sin clave del proveedor no está disponible', async () => {
    const sinClave = new AskAssistant(
      null,
      sources,
      { profileOf: () => Promise.resolve({ name: 'Ana', timezone: 'UTC' }) },
      new FixedClock(new Date()),
    );

    const result = await sinClave.execute(ANA, PREGUNTA);

    expect(result.ok ? null : result.error).toBeInstanceOf(AssistantUnavailable);
  });
});

describe('lo que acepta la ruta', () => {
  it('solo texto, y terminando en una pregunta', () => {
    expect(assistantChatSchema.safeParse({ messages: PREGUNTA }).success).toBe(true);
    expect(
      assistantChatSchema.safeParse({ messages: [{ role: 'assistant', text: 'Hola' }] }).success,
    ).toBe(false);
    expect(
      assistantChatSchema.safeParse({ messages: [{ role: 'tool', text: '{"datos":1}' }] }).success,
    ).toBe(false);
  });

  it('no más de 20 turnos ni preguntas de más de 2.000 caracteres', () => {
    const veintiuno = Array.from({ length: 21 }, () => PREGUNTA[0]);

    expect(assistantChatSchema.safeParse({ messages: veintiuno }).success).toBe(false);
    expect(
      assistantChatSchema.safeParse({ messages: [{ role: 'user', text: 'a'.repeat(2_001) }] })
        .success,
    ).toBe(false);
  });
});

describe('inWords', () => {
  it('le da al modelo las fechas ya escritas, en la zona de la cuenta', () => {
    expect(
      inWords(
        { dia: '2026-11-11', envio: new Date('2026-11-12T01:45:00Z'), nombre: 'Leer' },
        'America/Bogota',
      ),
    ).toEqual({
      dia: 'miércoles, 11 de noviembre',
      envio: 'miércoles, 11 de noviembre, 20:45',
      nombre: 'Leer',
    });
  });
});
