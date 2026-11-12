import { HABIT_PLAN_STATUS_LABELS, habitPlanStatus } from '@reconectate/contracts';
import type { AssistantSource } from '../../shared/assistant-source';
import { HabitPlanId } from '../../shared/identifiers';
import type { PlanView, ReadHabitPlans } from '../application/habit-plan-use-cases';

/**
 * Los planes de hábitos, para el asistente.
 *
 * Sale de `ReadHabitPlans` y no de una consulta propia: los porcentajes son los
 * mismos que pinta la pantalla, día en curso incluido. Si el asistente contara
 * por su cuenta, tarde o temprano diría un número distinto al de "Yo en 30 días".
 */
export function habitPlansSource(read: ReadHabitPlans): AssistantSource {
  return {
    async list(ownerId) {
      return (await read.list(ownerId)).map(summary);
    },

    async detail(ownerId, id) {
      if (!HabitPlanId.is(id)) return null;

      const plan = await read.detail(ownerId, id);

      if (!plan.ok) return null;

      return {
        ...summary(plan.value),
        habitos: plan.value.habits.map((habit) => ({
          nombre: habit.label,
          porcentaje: habit.percent,
          // Un día sin porcentaje no contó: ese día no salió nada de esa biblioteca.
          dias: habit.days.map((day) => ({
            dia: day.day,
            enviados: day.sent,
            respondidos: day.answered,
            porcentaje: day.percent,
            resultado: band(day.percent),
          })),
        })),
      };
    },
  };
}

function summary(plan: PlanView) {
  return {
    id: plan.id,
    nombre: plan.name,
    estado: HABIT_PLAN_STATUS_LABELS[habitPlanStatus.is(plan.status) ? plan.status : 'ACTIVE'],
    destinatario: plan.recipientLabel,
    dia: `${Math.min(plan.dayNumber, plan.durationDays)} de ${plan.durationDays}`,
    inicio: plan.startOn,
    fin: plan.endOn,
    porcentaje: plan.percent,
    avisosDeProgresoAlDia: plan.progressPerDay,
    habitos: plan.habits.map((habit) => `${habit.label}: ${habit.percent ?? '—'} %`),
  };
}

/** Las bandas de colores de la pantalla, dichas en palabras. */
function band(percent: number | null): string {
  if (percent === null) return 'sin envíos ese día';
  if (percent >= 80) return 'cumplido';
  if (percent >= 50) return 'a medias';

  return 'no cumplido';
}
