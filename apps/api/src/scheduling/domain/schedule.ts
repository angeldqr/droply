import { InvalidInputError } from '../../shared/domain-error';
import type { LibraryId, RecipientId, ScheduleId, UserId } from '../../shared/identifiers';
import { err, ok, type Result } from '../../shared/result';
import type { ItemKind } from './item-kind';

export const SENDER_NAME_MAX_LENGTH = 40;
export const MINUTES_IN_A_DAY = 24 * 60;

export interface ScheduleSnapshot {
  readonly id: ScheduleId;
  readonly ownerId: UserId;
  readonly libraryId: LibraryId;
  readonly recipientId: RecipientId;
  readonly weekdays: readonly number[];
  readonly startMinute: number;
  readonly endMinute: number;
  readonly timezone: string;
  readonly senderName: string | null;
  readonly kindFilter: ItemKind | null;
  readonly active: boolean;
  readonly nextRunAt: Date | null;
  readonly lastRunAt: Date | null;
  readonly createdAt: Date;
}

export interface ScheduleFields {
  /** 1 = lunes … 7 = domingo. Nunca vacío. */
  readonly weekdays: readonly number[];
  readonly startMinute: number;
  readonly endMinute: number;
  readonly timezone: string;
  /** Vacío o nulo significa "el nombre de la cuenta". */
  readonly senderName: string | null;
  readonly kindFilter: ItemKind | null;
}

/**
 * Cuándo sale un envío, de qué biblioteca y hacia quién.
 *
 * `nextRunAt` es lo único que el tick consulta cada minuto, y por eso vive en
 * la fila y no se recalcula al vuelo: una consulta por índice sobre una fecha
 * es barata, y evaluar la regla de miles de horarios cada minuto no lo sería.
 * La regla se vuelve a evaluar solo cuando el horario acaba de dispararse o
 * cuando alguien la cambia.
 */
export class Schedule {
  private constructor(private state: ScheduleSnapshot) {}

  static create(input: {
    id: ScheduleId;
    ownerId: UserId;
    libraryId: LibraryId;
    recipientId: RecipientId;
    fields: ScheduleFields;
    firstRunAt: Date;
    now: Date;
  }): Result<Schedule, InvalidInputError> {
    const fields = normalize(input.fields);
    if (!fields.ok) return fields;

    return ok(
      new Schedule({
        id: input.id,
        ownerId: input.ownerId,
        libraryId: input.libraryId,
        recipientId: input.recipientId,
        ...fields.value,
        active: true,
        nextRunAt: input.firstRunAt,
        lastRunAt: null,
        createdAt: input.now,
      }),
    );
  }

  static fromSnapshot(snapshot: ScheduleSnapshot): Schedule {
    return new Schedule(snapshot);
  }

  get id(): ScheduleId {
    return this.state.id;
  }

  get ownerId(): UserId {
    return this.state.ownerId;
  }

  get libraryId(): LibraryId {
    return this.state.libraryId;
  }

  get recipientId(): RecipientId {
    return this.state.recipientId;
  }

  get weekdays(): readonly number[] {
    return this.state.weekdays;
  }

  get startMinute(): number {
    return this.state.startMinute;
  }

  get endMinute(): number {
    return this.state.endMinute;
  }

  get timezone(): string {
    return this.state.timezone;
  }

  get senderName(): string | null {
    return this.state.senderName;
  }

  get kindFilter(): ItemKind | null {
    return this.state.kindFilter;
  }

  get active(): boolean {
    return this.state.active;
  }

  get nextRunAt(): Date | null {
    return this.state.nextRunAt;
  }

  get lastRunAt(): Date | null {
    return this.state.lastRunAt;
  }

  /** Cambiar la regla obliga a recalcular: la fecha guardada era de la vieja. */
  reschedule(fields: ScheduleFields, nextRunAt: Date | null): Result<void, InvalidInputError> {
    const normalized = normalize(fields);
    if (!normalized.ok) return normalized;

    this.state = { ...this.state, ...normalized.value, nextRunAt };

    return ok();
  }

  /**
   * Pausar deja la fecha calculada donde está en vez de borrarla, así reanudar
   * no obliga a recalcular. El tick igual no la mira: filtra por `active`.
   */
  setActive(active: boolean): void {
    this.state = { ...this.state, active };
  }

  /**
   * La rejilla cambió sin que cambiara la regla.
   *
   * Pasa cuando se clava o se quita un envío fijo: los días y la franja son los
   * mismos, pero ahora hay una hora más —o una menos— a la que despertarse, y
   * la fecha guardada se calculó sin ella.
   */
  retime(nextRunAt: Date | null): void {
    this.state = { ...this.state, nextRunAt };
  }

  /**
   * El horario acaba de dispararse. `nextRunAt` en `null` significa que la
   * regla se agotó —"todos los días hasta el 30"— y el horario deja de correr
   * sin necesidad de que nadie lo apague a mano.
   */
  markRun(occurredAt: Date, nextRunAt: Date | null): void {
    this.state = { ...this.state, lastRunAt: occurredAt, nextRunAt };
  }

  toSnapshot(): ScheduleSnapshot {
    return this.state;
  }
}

function normalize(fields: ScheduleFields): Result<ScheduleFields, InvalidInputError> {
  // Sin días no se dispararía nunca, y un día fuera de rango sería un horario
  // que el calendario no sabe ubicar.
  const weekdays = [...new Set(fields.weekdays)].sort((left, right) => left - right);

  if (weekdays.length === 0 || weekdays.some((day) => day < 1 || day > 7)) {
    return err(new InvalidInputError('schedule.weekdays_invalid', 'Elige al menos un día.'));
  }

  const withinDay = (minute: number) =>
    Number.isInteger(minute) && minute >= 0 && minute < MINUTES_IN_A_DAY;

  if (!withinDay(fields.startMinute) || !withinDay(fields.endMinute)) {
    return err(new InvalidInputError('schedule.window_invalid', 'Esa franja horaria no vale.'));
  }

  /*
   * El fin va después del inicio, sin excepciones.
   *
   * Una franja que cruzara la medianoche —de 22:00 a 6:00— parece útil hasta
   * que hay que repartir envíos dentro de ella: la mitad caen en el día
   * siguiente y "cuántas veces al día" deja de significar algo. Si alguna vez
   * hace falta, se expresa con dos horarios.
   */
  if (fields.endMinute <= fields.startMinute) {
    return err(
      new InvalidInputError(
        'schedule.window_backwards',
        'La hora de fin tiene que ser posterior a la de inicio.',
      ),
    );
  }

  if (fields.timezone.trim().length === 0) {
    return err(new InvalidInputError('schedule.timezone_required', 'Falta la zona horaria.'));
  }

  // Un nombre en blanco es lo mismo que no haber puesto ninguno: se guarda nulo
  // para que exista una sola forma de decir "firma con el nombre de la cuenta".
  const senderName = fields.senderName?.trim() ?? '';

  if (senderName.length > SENDER_NAME_MAX_LENGTH) {
    return err(
      new InvalidInputError(
        'schedule.sender_name_too_long',
        `El nombre de quien envía no puede pasar de ${SENDER_NAME_MAX_LENGTH} caracteres.`,
      ),
    );
  }

  return ok({
    ...fields,
    weekdays,
    timezone: fields.timezone.trim(),
    senderName: senderName.length > 0 ? senderName : null,
  });
}
