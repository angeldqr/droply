'use client';

import type {
  AddTextItemInput,
  SetLibraryRecipientsInput,
  SetTimesPerDayInput,
  CopyFromVaultInput,
  CreateLibraryInput,
  LibraryDetail,
  LibraryItemView,
  LibrarySummary,
  MoveItemInput,
  RenameLibraryInput,
  StartUploadResult,
  UploadableKind,
} from '@droply/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { uploadToStorage } from './upload';

const listKey = ['libraries'] as const;
const detailKey = (id: string) => ['libraries', id] as const;

/**
 * El baúl se pide por su nombre y no por su identificador, porque el navegador
 * no lo sabe hasta que responde: es el servidor quien lo crea la primera vez.
 */
const vaultKey = ['libraries', 'vault'] as const;

/**
 * Tocar un elemento invalida el prefijo entero y no una biblioteca sola.
 *
 * Copiar del baúl cambia dos pantallas a la vez, y los contadores del listado
 * cambian con cada elemento que entra o sale. Invalidar el prefijo solo vuelve
 * a pedir lo que está en pantalla, así que la vuelta de más no se nota.
 */
const everything = { queryKey: listKey } as const;

export function useLibraries() {
  return useQuery({
    queryKey: listKey,
    queryFn: () => api<LibrarySummary[]>('/libraries'),
  });
}

export function useVault() {
  return useQuery({
    queryKey: vaultKey,
    queryFn: () => api<LibraryDetail>('/libraries/vault'),
  });
}

export function useLibrary(id: string) {
  return useQuery({
    queryKey: detailKey(id),
    queryFn: () => api<LibraryDetail>(`/libraries/${encodeURIComponent(id)}`),
  });
}

const recipientsKey = (libraryId: string) => ['libraries', libraryId, 'recipients'] as const;

/** A quién se le puede enviar lo de esta biblioteca. Solo identificadores. */
export function useLibraryRecipients(libraryId: string) {
  return useQuery({
    queryKey: recipientsKey(libraryId),
    queryFn: () => api<string[]>(`/libraries/${encodeURIComponent(libraryId)}/recipients`),
  });
}

export function useSetLibraryRecipients(libraryId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SetLibraryRecipientsInput) =>
      api<string[]>(`/libraries/${encodeURIComponent(libraryId)}/recipients`, {
        method: 'PUT',
        body: input,
      }),
    // Cambia también qué horarios se pueden crear, así que se invalida todo.
    onSuccess: () => queryClient.invalidateQueries(everything),
  });
}

export function useCreateLibrary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateLibraryInput) =>
      api<LibrarySummary>('/libraries', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listKey }),
  });
}

export function useRenameLibrary(libraryId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RenameLibraryInput) =>
      api<LibrarySummary>(`/libraries/${encodeURIComponent(libraryId)}`, {
        method: 'PATCH',
        body: input,
      }),
    // El nombre sale en las dos pantallas, así que las dos se quedaron viejas.
    onSuccess: () => queryClient.invalidateQueries(everything),
  });
}

export function useDeleteLibrary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (libraryId: string) =>
      api<void>(`/libraries/${encodeURIComponent(libraryId)}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listKey }),
  });
}

export function useAddTextItem(libraryId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AddTextItemInput) =>
      api<LibraryItemView>(`/libraries/${encodeURIComponent(libraryId)}/items/text`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries(everything),
  });
}

export function useRemoveItem(libraryId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) =>
      api<void>(`/libraries/${encodeURIComponent(libraryId)}/items/${encodeURIComponent(itemId)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => queryClient.invalidateQueries(everything),
  });
}

export function useMoveItem(libraryId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, ...target }: MoveItemInput & { itemId: string }) =>
      api<void>(
        `/libraries/${encodeURIComponent(libraryId)}/items/${encodeURIComponent(itemId)}/position`,
        {
          method: 'PATCH',
          body: target,
        },
      ),
    onSuccess: () => queryClient.invalidateQueries(everything),
  });
}

/** Cuántas veces al día se manda este elemento dentro de la franja del horario. */
export function useSetTimesPerDay(libraryId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, ...input }: SetTimesPerDayInput & { itemId: string }) =>
      api<LibraryItemView>(
        `/libraries/${encodeURIComponent(libraryId)}/items/${encodeURIComponent(itemId)}/repetitions`,
        { method: 'PATCH', body: input },
      ),
    onSuccess: () => queryClient.invalidateQueries(everything),
  });
}

/** Trae a esta biblioteca una copia de algo que ya está guardado en el baúl. */
export function useCopyFromVault(libraryId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CopyFromVaultInput) =>
      api<LibraryItemView>(`/libraries/${encodeURIComponent(libraryId)}/items/copy`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries(everything),
  });
}

/**
 * Los tres pasos de una subida, encadenados: pedir el permiso, mandar el
 * archivo al almacenamiento y avisarle al API que ya está para que compruebe
 * qué llegó de verdad.
 */
export function useUploadMedia(libraryId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      kind,
      file,
      onProgress,
    }: {
      kind: UploadableKind;
      file: File;
      onProgress: (fraction: number) => void;
    }) => {
      const started = await api<StartUploadResult>(
        `/libraries/${encodeURIComponent(libraryId)}/items/media`,
        {
          method: 'POST',
          body: { kind, fileName: file.name, mimeType: file.type, sizeBytes: file.size },
        },
      );

      await uploadToStorage(started.upload, file, onProgress);

      await api<void>(
        `/libraries/${encodeURIComponent(libraryId)}/items/${encodeURIComponent(started.item.id)}/confirm`,
        { method: 'POST' },
      );
    },
    // Se recarga pase lo que pase: si la verificación rechazó el archivo, el
    // servidor ya borró el elemento, y la pantalla tiene que enterarse.
    onSettled: () => queryClient.invalidateQueries(everything),
  });
}
