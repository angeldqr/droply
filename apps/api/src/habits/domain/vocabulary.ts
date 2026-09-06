export type { HabitAnswer } from '../../shared/habit-vote';
export { HABIT_ANSWERS, isHabitAnswer } from '../../shared/habit-vote';

/**
 * El estado de un plan.
 *
 * Es una copia: el núcleo no puede importar `@reconectate/contracts`, así que
 * la lista está escrita otra vez acá y el test guardián de al lado la ata al
 * contrato. Las respuestas no necesitan copia propia porque ya viven en
 * `shared/habit-vote`, que es donde tienen que estar: las escribe `delivery` al
 * armar el botón y las lee `recipients` al recibir el toque.
 */
export const HABIT_PLAN_STATUSES = ['ACTIVE', 'CANCELLED', 'CLOSED'] as const;

export type HabitPlanStatus = (typeof HABIT_PLAN_STATUSES)[number];
