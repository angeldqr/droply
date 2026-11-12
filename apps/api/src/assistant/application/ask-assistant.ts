import type { AssistantSource } from '../../shared/assistant-source';
import type { Clock } from '../../shared/clock';
import { RateLimitedError, UnavailableError, type DomainError } from '../../shared/domain-error';
import type { UserId } from '../../shared/identifiers';
import { err, ok, type Result } from '../../shared/result';
import type { AccountReader, AssistantModel, AssistantTool, ChatTurn } from '../domain/ports';

/**
 * Preguntas por cuenta y por día.
 *
 * El plan gratuito del proveedor tiene un tope diario de tokens para toda la
 * aplicación, y una pregunta gasta entre 3.000 y 8.000. Sin esto, una sola
 * persona curiosa dejaría sin asistente a todas las demás.
 */
export const ASSISTANT_DAILY_LIMIT = 15;

export interface AssistantSources {
  readonly habitPlans: AssistantSource;
  readonly journal: AssistantSource;
  readonly libraries: AssistantSource;
  readonly recipients: AssistantSource;
  readonly schedules: AssistantSource;
  readonly deliveries: AssistantSource;
}

export class AssistantUnavailable extends UnavailableError {
  constructor() {
    super('assistant.unavailable', 'El asistente no está disponible por ahora.');
  }
}

export class AssistantDailyLimit extends RateLimitedError {
  constructor() {
    super(
      'assistant.daily_limit',
      `Ya hiciste las ${ASSISTANT_DAILY_LIMIT} preguntas de hoy. Vuelve mañana.`,
    );
  }
}

const NOT_FOUND = { error: 'No existe en esta cuenta.' };

/**
 * Responde una pregunta sobre la aplicación o sobre los datos de quien pregunta.
 *
 * Lo que garantiza que no vea otra cuenta no son las instrucciones del modelo
 * sino esto: cada lectura se arma acá con el `ownerId` de la sesión, y el
 * modelo solo recibe las lecturas ya atadas. Ninguna escribe.
 */
export class AskAssistant {
  // ponytail: contador en memoria, se reinicia con la API y no se comparte
  // entre réplicas. Pasarlo a la base si algún día hay más de una.
  private readonly asked = new Map<UserId, { day: string; count: number }>();

  constructor(
    /** `null` cuando no hay clave del proveedor en el entorno. */
    private readonly model: AssistantModel | null,
    private readonly sources: AssistantSources,
    private readonly accounts: AccountReader,
    private readonly clock: Clock,
  ) {}

  async execute(
    ownerId: UserId,
    turns: readonly ChatTurn[],
    signal?: AbortSignal,
  ): Promise<Result<Response, DomainError>> {
    if (!this.model) return err(new AssistantUnavailable());

    const now = this.clock.now();
    const day = now.toISOString().slice(0, 10);
    const seen = this.asked.get(ownerId);
    const count = seen?.day === day ? seen.count : 0;

    if (count >= ASSISTANT_DAILY_LIMIT) return err(new AssistantDailyLimit());

    this.asked.set(ownerId, { day, count: count + 1 });

    const profile = await this.accounts.profileOf(ownerId);
    const today = new Intl.DateTimeFormat('es', {
      timeZone: profile.timezone,
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(now);

    return ok(
      this.model.answer({
        context: `Quien pregunta se llama ${profile.name}. Para esta persona hoy es ${today}. Esa es la fecha de hoy: no la calcules ni la cambies.`,
        turns,
        tools: toolsOf(ownerId, this.sources, profile.timezone),
        signal,
      }),
    );
  }
}

/** Las lecturas que el modelo puede pedir, todas atadas a `ownerId`. */
export function toolsOf(
  ownerId: UserId,
  sources: AssistantSources,
  timezone: string,
): AssistantTool[] {
  const detail = (source: AssistantSource) => async (id?: string) =>
    (await source.detail?.(ownerId, id ?? '')) ?? NOT_FOUND;

  const tools: AssistantTool[] = [
    {
      name: 'planes_de_habitos',
      description:
        'Lista los planes de hábitos: estado, día en que va, fechas, destinatario y porcentaje de cada hábito.',
      run: () => sources.habitPlans.list(ownerId),
    },
    {
      name: 'detalle_plan',
      description:
        'El avance día por día de un plan: por cada hábito, cuántos envíos salieron, cuántos se respondieron y el porcentaje del día.',
      idDescription: 'El id de un plan, tal como sale en planes_de_habitos.',
      run: detail(sources.habitPlans),
    },
    {
      name: 'mi_bitacora',
      description:
        'Los hábitos personales de Mi bitácora: meta diaria, días en que aplica, anotaciones de esta semana, racha y si está en pausa.',
      run: () => sources.journal.list(ownerId),
    },
    {
      name: 'anotaciones_de_habito',
      description: 'Las anotaciones más recientes de un hábito de Mi bitácora, con su nota.',
      idDescription: 'El id de un hábito, tal como sale en mi_bitacora.',
      run: detail(sources.journal),
    },
    {
      name: 'bibliotecas',
      description: 'Las bibliotecas y el baúl, con cuántos elementos de cada tipo tienen.',
      run: () => sources.libraries.list(ownerId),
    },
    {
      name: 'detalle_biblioteca',
      description: 'Los elementos de una biblioteca o del baúl: tipo, texto y veces al día.',
      idDescription: 'El id de una biblioteca, tal como sale en bibliotecas.',
      run: detail(sources.libraries),
    },
    {
      name: 'destinatarios',
      description: 'Los destinatarios: nombre, canal y si ya vincularon su chat.',
      run: () => sources.recipients.list(ownerId),
    },
    {
      name: 'horarios',
      description:
        'Los horarios de envío: biblioteca, destinatario, días, franja horaria y próximo envío.',
      run: () => sources.schedules.list(ownerId),
    },
    {
      name: 'envios_recientes',
      description: 'Los últimos envíos: cuándo, de qué biblioteca, a quién y si salieron.',
      run: () => sources.deliveries.list(ownerId),
    },
  ];

  return tools.map((tool) => ({
    ...tool,
    run: async (id) => inWords(await tool.run(id), timezone),
  }));
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MOMENT = /^\d{4}-\d{2}-\d{2}T/;

/**
 * Pasa las fechas de una lectura a palabras, en la zona de la cuenta.
 *
 * El modelo se equivoca al sacar el día de la semana de "2026-11-11" o la hora
 * local de un instante en UTC. Leído como "miércoles, 11 de noviembre" no.
 */
export function inWords(value: unknown, timezone: string): unknown {
  if (value instanceof Date) return momentInWords(value, timezone);

  if (typeof value === 'string') {
    // Mediodía en UTC: así la zona no corre la fecha a otro día.
    if (DAY.test(value)) return dayInWords.format(new Date(`${value}T12:00:00Z`));
    if (MOMENT.test(value)) return momentInWords(new Date(value), timezone);

    return value;
  }

  if (Array.isArray(value)) return value.map((item) => inWords(item, timezone));

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, inWords(item, timezone)]),
    );
  }

  return value;
}

const dayInWords = new Intl.DateTimeFormat('es', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

function momentInWords(moment: Date, timezone: string): string {
  if (Number.isNaN(moment.getTime())) return '';

  return new Intl.DateTimeFormat('es', {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(moment);
}
