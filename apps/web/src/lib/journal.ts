'use client';

import type {
  AccountChatView,
  CreateHabitInput,
  HabitEntryView,
  HabitView,
  UpdateHabitInput,
} from '@reconectate/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

const habitsKey = ['journal', 'habits'] as const;

const entriesKey = (habitId: string) => ['journal', 'habits', habitId, 'entries'] as const;

const chatKey = ['journal', 'chat'] as const;

export function useHabits() {
  return useQuery({
    queryKey: habitsKey,
    queryFn: () => api<HabitView[]>('/journal/habits'),
  });
}

/**
 * La bitácora de un hábito.
 *
 * Se recarga sola cada minuto: las anotaciones llegan desde el teléfono sin que
 * nadie toque esta pantalla, así que no hay ninguna acción a la que colgar la
 * invalidación. Es lo mismo que hacen el historial de envíos y los avisos.
 */
export function useHabitEntries(habitId: string) {
  return useQuery({
    queryKey: entriesKey(habitId),
    queryFn: () => api<HabitEntryView[]>(`/journal/habits/${encodeURIComponent(habitId)}/entries`),
    refetchInterval: 60_000,
  });
}

export function useCreateHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateHabitInput) =>
      api<HabitView>('/journal/habits', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: habitsKey }),
  });
}

export function useUpdateHabit(habitId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateHabitInput) =>
      api<HabitView>(`/journal/habits/${encodeURIComponent(habitId)}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: habitsKey }),
  });
}

/** Pausar o reanudar: la lista vuelve a pedir la fila con su nuevo estado. */
function usePauseChange(habitId: string, action: 'pause' | 'resume') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      api<HabitView>(`/journal/habits/${encodeURIComponent(habitId)}/${action}`, {
        method: 'POST',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: habitsKey }),
  });
}

export function usePauseHabit(habitId: string) {
  return usePauseChange(habitId, 'pause');
}

export function useResumeHabit(habitId: string) {
  return usePauseChange(habitId, 'resume');
}

export function useDeleteHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (habitId: string) =>
      api<void>(`/journal/habits/${encodeURIComponent(habitId)}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: habitsKey }),
  });
}

export function useDeleteEntry(habitId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entryId: string) =>
      api<void>(`/journal/entries/${encodeURIComponent(entryId)}`, { method: 'DELETE' }),
    // Borrar una anotación cambia la lista —el contador y la última fecha— y la
    // bitácora que se está mirando.
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: entriesKey(habitId) });

      return queryClient.invalidateQueries({ queryKey: habitsKey });
    },
  });
}

/** Si la cuenta ya tiene su Telegram conectado. */
export function useAccountChat() {
  return useQuery({
    queryKey: chatKey,
    queryFn: () => api<AccountChatView>('/journal/chat'),
  });
}

/**
 * Pide un enlace nuevo.
 *
 * El resultado **no se guarda en la caché**: el código en claro solo existe en
 * esta respuesta, así que quien lo necesite tiene que quedárselo del resultado
 * de la mutación. Volver a leerlo de la caché daría `null`.
 */
export function useLinkAccountChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api<AccountChatView>('/journal/chat/link', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chatKey }),
  });
}

export function useUnlinkAccountChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api<void>('/journal/chat', { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chatKey }),
  });
}
