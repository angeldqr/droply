'use client';

import type {
  AccountDetailView,
  AccountSummaryView,
  RegisterInput,
  TemporaryPasswordView,
} from '@reconectate/contracts';
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

/**
 * Las tres acciones sobre una cuenta ajena.
 *
 * Viven en `auth` y no en `admin` por lo mismo que crear: tocar una cuenta es
 * del contexto de identidad, y el panel solo lee. Todas invalidan el listado y
 * el detalle, porque las dos vistas muestran lo que acaba de cambiar.
 */
function useAccountAction<TInput, TOutput>(
  run: (input: TInput) => Promise<TOutput>,
): ReturnType<typeof useMutation<TOutput, Error, TInput>> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: run,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });
}

/** Devuelve una contraseña temporal que solo se puede ver una vez. */
export function useResetAccountPassword() {
  return useAccountAction((userId: string) =>
    api<TemporaryPasswordView>(`/auth/users/${encodeURIComponent(userId)}/password`, {
      method: 'POST',
    }),
  );
}

export function useSetAccountActive() {
  return useAccountAction(({ userId, active }: { userId: string; active: boolean }) =>
    api<void>(`/auth/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: { active },
    }),
  );
}

export function useDeleteAccount() {
  return useAccountAction((userId: string) =>
    api<void>(`/auth/users/${encodeURIComponent(userId)}`, { method: 'DELETE' }),
  );
}
