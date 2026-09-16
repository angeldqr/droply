import type { HabitEntryId, HabitId, UserId } from '../../shared/identifiers';

/** Lo que cabe en una anotación. Es un mensaje de chat, no un diario. */
export const NOTE_MAX_LENGTH = 2000;

/** Cuántas fotos admite antes de que el bot diga que ya está bien. */
export const PHOTOS_MAX = 10;

/**
 * Qué se acepta como foto.
 *
 * Los mismos tipos y el mismo techo que una imagen de una biblioteca: van al
 * mismo bucket y valen lo mismo. El GIF se queda fuera a propósito —Telegram lo
 * manda como animación, no como foto— y el guardián de `limits.spec.ts` ata
 * esta lista a la del contrato.
 */
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Cuánto aguanta abierta sin que llegue nada.
 *
 * Media hora es lo que separa «sigo contando lo del gimnasio» de «vuelvo por la
 * tarde a contar otra cosa». Pasado eso, lo nuevo abre otra anotación en vez de
 * pegarse a lo de la mañana.
 */
export const IDLE_MINUTES = 30;

const MINUTE_MS = 60 * 1000;

export interface HabitEntrySnapshot {
  readonly id: HabitEntryId;
  readonly habitId: HabitId;
  readonly ownerId: UserId;
  readonly chatId: string;
  readonly note: string | null;
  readonly openedAt: Date;
  readonly closedAt: Date | null;
  /** Cuándo llegó lo último. Es lo que decide si caducó. */
  readonly touchedAt: Date;
  readonly photoCount: number;
}

/**
 * Una anotación: lo que el usuario contó que hizo, con sus fotos.
 *
 * **Mientras está abierta es el estado de la conversación.** No hay una tabla
 * de sesiones aparte: la anotación abierta de un chat dice a qué hábito se está
 * escribiendo, y una segunda tabla sería el mismo hecho escrito dos veces.
 */
export class HabitEntry {
  private constructor(private state: HabitEntrySnapshot) {}

  static open(input: {
    id: HabitEntryId;
    habitId: HabitId;
    ownerId: UserId;
    chatId: string;
    now: Date;
  }): HabitEntry {
    return new HabitEntry({
      id: input.id,
      habitId: input.habitId,
      ownerId: input.ownerId,
      chatId: input.chatId,
      note: null,
      openedAt: input.now,
      closedAt: null,
      touchedAt: input.now,
      photoCount: 0,
    });
  }

  static fromSnapshot(snapshot: HabitEntrySnapshot): HabitEntry {
    return new HabitEntry(snapshot);
  }

  toSnapshot(): HabitEntrySnapshot {
    return this.state;
  }

  get id(): HabitEntryId {
    return this.state.id;
  }

  get habitId(): HabitId {
    return this.state.habitId;
  }

  get ownerId(): UserId {
    return this.state.ownerId;
  }

  get isOpen(): boolean {
    return this.state.closedAt === null;
  }

  /** Ni nota ni fotos: no hay nada que guardar. */
  get isEmpty(): boolean {
    return this.state.note === null && this.state.photoCount === 0;
  }

  get photoCount(): number {
    return this.state.photoCount;
  }

  get noteLength(): number {
    return this.state.note?.length ?? 0;
  }

  /** Si pasó demasiado rato sin que llegara nada. */
  hasGoneStale(now: Date): boolean {
    return now.getTime() - this.state.touchedAt.getTime() > IDLE_MINUTES * MINUTE_MS;
  }

  /**
   * Añade lo que el usuario escribió.
   *
   * Los mensajes seguidos se acumulan separados por un salto de línea en vez de
   * pisarse: quien manda tres frases sueltas está contando una cosa, no tres.
   * Lo que pase del tope se recorta, porque tirar lo que alguien acaba de
   * escribir es peor que guardarlo a medias.
   */
  addNote(text: string, now: Date): void {
    const clean = text.trim();

    if (clean.length === 0) return;

    const joined = this.state.note === null ? clean : `${this.state.note}\n${clean}`;

    this.state = {
      ...this.state,
      note: joined.slice(0, NOTE_MAX_LENGTH),
      touchedAt: now,
    };
  }

  /** Si todavía cabe una foto más. */
  acceptsPhoto(): boolean {
    return this.state.photoCount < PHOTOS_MAX;
  }

  /**
   * Anota cuántas fotos tiene, con el número que devolvió la base.
   *
   * No suma uno: las de un álbum entran a la vez y cada una vuelve con el total
   * real. Sumando en memoria, la que cerrara la anotación diría un número que
   * no es el que hay guardado.
   */
  countPhotos(total: number, now: Date): void {
    this.state = { ...this.state, photoCount: total, touchedAt: now };
  }

  /**
   * La pasa a otro hábito.
   *
   * Solo mientras está abierta: una cerrada ya se leyó en la pantalla con su
   * hábito, y moverla desde el chat sería cambiar algo que el usuario no ve.
   */
  moveTo(habitId: HabitId, now: Date): void {
    if (!this.isOpen) return;

    this.state = { ...this.state, habitId, touchedAt: now };
  }

  close(now: Date): void {
    if (!this.isOpen) return;

    this.state = { ...this.state, closedAt: now };
  }
}
