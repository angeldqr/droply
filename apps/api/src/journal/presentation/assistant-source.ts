import { appliesOn, dayIn, isPausedOn, WEEKDAY_LABELS, WEEKDAYS } from '@reconectate/contracts';
import { clip, type AssistantSource } from '../../shared/assistant-source';
import { HabitId } from '../../shared/identifiers';
import type { HabitRow, ReadJournal } from '../application/habit-use-cases';
import type { HabitRepository } from '../domain/ports';

/** Las anotaciones de un hábito que ve el asistente: las más recientes. */
const ENTRIES_LIMIT = 30;

/**
 * Mi bitácora, para el asistente. Sale de las mismas lecturas que la pantalla.
 *
 * Cada día de la semana va con su veredicto ya puesto: el modelo se equivocaba
 * al deducir qué días aplicaban y cuáles ya habían pasado.
 */
export function journalSource(read: ReadJournal, habits: HabitRepository): AssistantSource {
  return {
    async list(ownerId) {
      const [rows, timezone] = await Promise.all([read.list(ownerId), habits.timezoneOf(ownerId)]);

      return rows.map((habit) => ({
        id: habit.id,
        nombre: habit.name,
        metaDiaria: habit.dailyTarget,
        // El lunes es el bit 0 y el día 1.
        dias: WEEKDAYS.filter((day) => (habit.activeDays & (1 << (day - 1))) !== 0).map(
          (day) => WEEKDAY_LABELS[day],
        ),
        anotacionesEnTotal: habit.entryCount,
        ultimaAnotacion: habit.lastEntryAt,
        hoy: habit.today,
        semana: habit.week.map(({ day, count }) => ({
          dia: day,
          anotaciones: count,
          resultado: verdict(habit, day, count, dayIn(timezone, habit.createdAt)),
        })),
        racha: habit.streak,
        enPausa: habit.paused,
      }));
    },

    async detail(ownerId, id) {
      if (!HabitId.is(id)) return null;

      const entries = await read.entriesOf(ownerId, id);

      if (!entries.ok) return null;

      return entries.value.slice(0, ENTRIES_LIMIT).map((entry) => ({
        abierta: entry.openedAt,
        cerrada: entry.closedAt,
        nota: clip(entry.note),
        fotos: entry.photos.length,
      }));
    },
  };
}

/** Lo mismo que pinta "Tu semana", dicho en palabras. */
function verdict(habit: HabitRow, day: string, count: number, since: string): string {
  if (day > habit.today) return 'todavía no llega';
  if (day < since) return 'el hábito aún no existía';
  if (isPausedOn(habit.pauses, day)) return 'en pausa';
  if (!appliesOn(habit.activeDays, day)) return 'día libre';
  if (count >= habit.dailyTarget) return 'cumplido';

  const progress = `${count} de ${habit.dailyTarget}`;

  return day === habit.today ? `en curso, lleva ${progress}` : `no cumplido, hizo ${progress}`;
}
