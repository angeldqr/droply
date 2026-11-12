import type { UserId } from './identifiers';

/**
 * Lo que un contexto le deja leer al asistente sobre una cuenta.
 *
 * Es la costura entre `assistant` y los demás, igual que `HabitVoteSink`: el
 * asistente no puede importar los casos de uso de nadie, así que cada contexto
 * envuelve su lectura en esto y la exporta con su token.
 *
 * El dueño lo pone siempre el asistente, desde la sesión. El modelo solo elige
 * qué leer, nunca de quién: por eso no hay ningún parámetro de usuario que él
 * pueda llenar.
 *
 * Devuelve datos planos, listos para JSON y ya recortados: cada token que se
 * manda al modelo cuenta contra el tope diario del proveedor.
 */
export interface AssistantSource {
  list(ownerId: UserId): Promise<unknown>;
  /** `null` si no existe, si el id no tiene forma de id o si es de otra cuenta. */
  detail?(ownerId: UserId, id: string): Promise<unknown>;
}

export const HABIT_PLANS_SOURCE = Symbol('HabitPlansSource');
export const JOURNAL_SOURCE = Symbol('JournalSource');
export const LIBRARIES_SOURCE = Symbol('LibrariesSource');
export const RECIPIENTS_SOURCE = Symbol('RecipientsSource');
export const SCHEDULES_SOURCE = Symbol('SchedulesSource');
export const DELIVERIES_SOURCE = Symbol('DeliveriesSource');

/** Recorta un texto largo: al modelo le basta el comienzo para reconocerlo. */
export function clip(text: string | null, max = 160): string | null {
  if (text === null) return null;

  return text.length > max ? `${text.slice(0, max)}…` : text;
}
