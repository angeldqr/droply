'use client';

import type { CreateRecipientInput, RecipientView } from '@droply/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

const listKey = ['recipients'] as const;

export function useRecipients() {
  return useQuery({
    queryKey: listKey,
    queryFn: () => api<RecipientView[]>('/recipients'),
  });
}

export function useCreateRecipient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateRecipientInput) =>
      api<RecipientView>('/recipients', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listKey }),
  });
}

/**
 * Pide un enlace nuevo.
 *
 * Es también la única forma de recuperar uno: el código en claro solo viaja en
 * la respuesta que lo creó, porque lo que se guarda es su hash. Pedir otro
 * invalida el anterior, así que un enlace que quedó dando vueltas en un chat
 * deja de servir en cuanto se genera el siguiente.
 */
export function useRelinkRecipient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recipientId: string) =>
      api<RecipientView>(`/recipients/${encodeURIComponent(recipientId)}/link`, {
        method: 'POST',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listKey }),
  });
}

export function useDeleteRecipient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recipientId: string) =>
      api<void>(`/recipients/${encodeURIComponent(recipientId)}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listKey }),
  });
}
