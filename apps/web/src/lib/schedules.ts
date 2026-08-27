'use client';

import type {
  CreateScheduleInput,
  DayPlanEntryView,
  DeliveryRecordView,
  FixedItemView,
  NoticeView,
  ScheduleView,
  SetFixedItemsInput,
  UpdateScheduleInput,
} from '@reconectate/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

const listKey = ['schedules'] as const;

export function useSchedules() {
  return useQuery({
    queryKey: listKey,
    queryFn: () => api<ScheduleView[]>('/schedules'),
  });
}

/**
 * Lo último que salió, con su resultado.
 *
 * Se recarga sola cada minuto: los envíos ocurren sin que nadie esté mirando la
 * pantalla, así que no hay ninguna acción a la que colgar la invalidación.
 */
export function useDeliveries() {
  return useQuery({
    queryKey: ['deliveries'],
    queryFn: () => api<DeliveryRecordView[]>('/deliveries'),
    refetchInterval: 60_000,
  });
}

const noticesKey = ['notices'] as const;

/**
 * Los avisos sin leer.
 *
 * Se recargan solos cada minuto por lo mismo que el historial: los envíos
 * ocurren sin que nadie esté mirando la pantalla, así que no hay ninguna acción
 * a la que colgar la invalidación.
 */
export function useNotices() {
  return useQuery({
    queryKey: noticesKey,
    queryFn: () => api<NoticeView[]>('/notices'),
    refetchInterval: 60_000,
  });
}

export function useMarkNoticeRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (noticeId: string) =>
      api<void>(`/notices/${encodeURIComponent(noticeId)}/read`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noticesKey }),
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateScheduleInput) =>
      api<ScheduleView>('/schedules', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listKey }),
  });
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ scheduleId, ...changes }: UpdateScheduleInput & { scheduleId: string }) =>
      api<ScheduleView>(`/schedules/${encodeURIComponent(scheduleId)}`, {
        method: 'PATCH',
        body: changes,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listKey }),
  });
}

const fixedKey = (scheduleId: string) => ['schedules', scheduleId, 'fixed-items'] as const;

/** Qué sale a qué hora en este horario, con el archivo ya resuelto. */
export function useFixedItems(scheduleId: string) {
  return useQuery({
    queryKey: fixedKey(scheduleId),
    queryFn: () => api<FixedItemView[]>(`/schedules/${encodeURIComponent(scheduleId)}/fixed-items`),
  });
}

const dayKey = (scheduleId: string) => ['schedules', scheduleId, 'day'] as const;

/**
 * El día entero del horario: lo clavado y lo repartido, en orden de hora.
 *
 * Es otra pregunta que la de `useFixedItems`. Aquella dice qué clavó el dueño;
 * esta, qué va a salir de verdad — que con la biblioteca entera clavada puede
 * ser bastante menos de lo que uno espera.
 */
export function useDayPlan(scheduleId: string, enabled: boolean) {
  return useQuery({
    queryKey: dayKey(scheduleId),
    queryFn: () => api<DayPlanEntryView[]>(`/schedules/${encodeURIComponent(scheduleId)}/day`),
    // Solo se pide cuando el diálogo está abierto: es una consulta por horario y
    // la lista puede tener unos cuantos.
    enabled,
  });
}

export function useSetFixedItems(scheduleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SetFixedItemsInput) =>
      api<void>(`/schedules/${encodeURIComponent(scheduleId)}/fixed-items`, {
        method: 'PUT',
        body: input,
      }),
    onSuccess: async () => {
      // Clavar algo mueve la próxima fecha del horario, así que la lista de
      // horarios también queda vieja. Y el día entero se reparte de otra forma
      // en cuanto cambia un solo clavado.
      await queryClient.invalidateQueries({ queryKey: fixedKey(scheduleId) });
      await queryClient.invalidateQueries({ queryKey: dayKey(scheduleId) });
      await queryClient.invalidateQueries({ queryKey: listKey });
    },
  });
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scheduleId: string) =>
      api<void>(`/schedules/${encodeURIComponent(scheduleId)}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listKey }),
  });
}

/**
 * La zona del navegador, que es la que el usuario tiene en la cabeza cuando
 * dice "a las ocho". No se le pregunta: se propone y se puede cambiar.
 */
export function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
