'use client';

import type { AccountDetailView, AccountSummaryView, RegisterInput } from '@droply/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

const listKey = ['admin', 'accounts'] as const;

export function useAccounts() {
  return useQuery({
    queryKey: listKey,
    queryFn: () => api<AccountSummaryView[]>('/admin/accounts'),
  });
}

export function useAccount(userId: string | null) {
  return useQuery({
    queryKey: ['admin', 'accounts', userId],
    queryFn: () => api<AccountDetailView>(`/admin/accounts/${encodeURIComponent(userId ?? '')}`),
    enabled: userId !== null,
  });
}

/**
 * Crear una cuenta es cosa de quien administra: no hay registro abierto.
 *
 * La ruta vive en `auth` y no en `admin` porque crear usuarios es del contexto
 * de identidad; el panel de administración solo lee.
 */
export function useCreateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RegisterInput) =>
      api<{ userId: string }>('/auth/users', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listKey }),
  });
}
