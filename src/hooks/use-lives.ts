/**
 * Hooks React Query das Lives da Comunidade — workspace-scoped.
 * Chaves escopadas por workspace (não vazar cache entre clientes).
 */
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  cancelLive,
  createLive,
  endLive,
  getLive,
  listLives,
  removeLive,
  refreshBroadcasterToken,
  startLive,
  updateLive,
} from "@/shared/services/lives";
import type {
  CreateLivePayload,
  LiveStatusFilter,
  UpdateLivePayload,
} from "@/shared/types";
import {
  useWorkspaceQueryKey,
  withWorkspaceKey,
} from "@/hooks/use-workspace-query-key";

const LIST_PAGE_SIZE = 20;

export const liveKeys = {
  all: ["lives"] as const,
  list: (status: LiveStatusFilter) => ["lives", "list", status] as const,
  detail: (id: string) => ["lives", "detail", id] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Lista paginada por cursor. Use `fetchNextPage`/`hasNextPage` para "carregar mais". */
export function useLives(
  status: LiveStatusFilter,
  options: { enabled?: boolean } = {},
) {
  const workspaceId = useWorkspaceQueryKey();
  return useInfiniteQuery({
    queryKey: withWorkspaceKey(liveKeys.list(status), workspaceId),
    queryFn: ({ pageParam }) =>
      listLives({ status, cursor: pageParam, limit: LIST_PAGE_SIZE }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) =>
      last.meta.has_more ? last.meta.next_cursor : undefined,
    enabled: (options.enabled ?? true) && !!workspaceId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useLive(
  id: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  const workspaceId = useWorkspaceQueryKey();
  return useQuery({
    queryKey: withWorkspaceKey(liveKeys.detail(id ?? ""), workspaceId),
    queryFn: () => getLive(id as string),
    enabled: (options.enabled ?? true) && !!id && !!workspaceId,
    staleTime: 15 * 1000,
    refetchOnWindowFocus: false,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateLive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateLivePayload) => createLive(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: liveKeys.all }),
  });
}

export function useUpdateLive(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateLivePayload) => updateLive(id, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: liveKeys.all }),
  });
}

export function useStartLive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => startLive(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: liveKeys.all }),
  });
}

export function useRefreshBroadcasterToken() {
  return useMutation({
    mutationFn: (id: string) => refreshBroadcasterToken(id),
  });
}

export function useEndLive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => endLive(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: liveKeys.all }),
  });
}

export function useCancelLive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelLive(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: liveKeys.all }),
  });
}

export function useRemoveLive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removeLive(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: liveKeys.all }),
  });
}
