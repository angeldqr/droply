'use client';

import type {
  AddTextItemInput,
  CreateLibraryInput,
  LibraryDetail,
  LibraryItemView,
  LibrarySummary,
  MoveItemInput,
} from '@droply/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

const listKey = ['libraries'] as const;
const detailKey = (id: string) => ['libraries', id] as const;

export function useLibraries() {
  return useQuery({
    queryKey: listKey,
    queryFn: () => api<LibrarySummary[]>('/libraries'),
  });
}

export function useLibrary(id: string) {
  return useQuery({
    queryKey: detailKey(id),
    queryFn: () => api<LibraryDetail>(`/libraries/${encodeURIComponent(id)}`),
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

export function useAddTextItem(libraryId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AddTextItemInput) =>
      api<LibraryItemView>(`/libraries/${encodeURIComponent(libraryId)}/items/text`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: detailKey(libraryId) }),
  });
}

export function useRemoveItem(libraryId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) =>
      api<void>(`/libraries/${encodeURIComponent(libraryId)}/items/${encodeURIComponent(itemId)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: detailKey(libraryId) }),
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: detailKey(libraryId) }),
  });
}
