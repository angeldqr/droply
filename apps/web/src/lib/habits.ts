'use client';

import type {
  CreateHabitPlanInput,
  HabitPlanDetail,
  HabitPlanSummary,
} from '@reconectate/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

const listKey = ['habit-plans'] as const;

const detailKey = (planId: string) => ['habit-plans', planId] as const;

export function useHabitPlans() {
  return useQuery({
    queryKey: listKey,
    queryFn: () => api<HabitPlanSummary[]>('/habit-plans'),
  });
}

/**
 * El detalle, con su rejilla.
 *
 * Se recarga sola cada minuto, por lo mismo que el historial de envíos: las
 * respuestas las aprieta otra persona en su teléfono, así que no hay ninguna
 * acción de esta pantalla a la que colgar la invalidación.
 */
export function useHabitPlan(planId: string) {
  return useQuery({
    queryKey: detailKey(planId),
    queryFn: () => api<HabitPlanDetail>(`/habit-plans/${encodeURIComponent(planId)}`),
    refetchInterval: 60_000,
  });
}

export function useCreateHabitPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateHabitPlanInput) =>
      api<HabitPlanSummary>('/habit-plans', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listKey }),
  });
}

export function useCancelHabitPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planId: string) =>
      api<HabitPlanSummary>(`/habit-plans/${encodeURIComponent(planId)}/cancel`, {
        method: 'POST',
      }),
    // Anular cambia las dos pantallas: el estado en el detalle y, sobre todo,
    // qué bibliotecas vuelven a poder elegirse en un plan nuevo.
    onSuccess: (_plan, planId) => {
      void queryClient.invalidateQueries({ queryKey: detailKey(planId) });

      return queryClient.invalidateQueries({ queryKey: listKey });
    },
  });
}

/**
 * Reenvía el informe de un plan terminado.
 *
 * No invalida nada: lo que cambia con esto está en el chat de la otra persona,
 * no en esta pantalla.
 */
export function useResendPlanReport() {
  return useMutation({
    mutationFn: (planId: string) =>
      api<void>(`/habit-plans/${encodeURIComponent(planId)}/report`, { method: 'POST' }),
  });
}

/**
 * Las bibliotecas que ya están en un plan en marcha.
 *
 * Una biblioteca solo puede ser un hábito de un plan a la vez: si no, un mismo
 * envío llegaría con dos juegos de botones y la respuesta no sabría a cuál
 * pertenece. Se calcula acá con lo que ya trajo el listado, en vez de pedirle
 * al servidor una lista más.
 */
export function librariesInUse(plans: readonly HabitPlanSummary[]): Map<string, string> {
  const taken = new Map<string, string>();

  for (const plan of plans) {
    if (plan.status !== 'ACTIVE') continue;

    for (const libraryId of plan.libraryIds) taken.set(libraryId, plan.name);
  }

  return taken;
}
