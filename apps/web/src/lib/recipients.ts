'use client';

import type { CreateRecipientInput, RecipientView } from '@reconectate/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

const listKey = ['recipients'] as const;

export function useRecipients() {
  return useQuery({
    queryKey: listKey,
    queryFn: () => api<RecipientView[]>('/recipients'),
    /*
     * Mientras quede alguien pendiente, la lista se recarga sola cada cinco
     * segundos.
     *
     * Es el único sitio de la aplicación donde el cambio no lo provoca quien
     * está mirando la pantalla, sino la otra persona desde Telegram: no hay
     * ninguna acción a la que colgar la invalidación, y sin esto habría que
     * recargar a mano para saber si ya se vinculó. En cuanto no queda ninguno
     * pendiente el sondeo se apaga.
     */
    refetchInterval: (query) =>
      query.state.data?.some((recipient) => recipient.status === 'PENDING') ? 5_000 : false,
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
