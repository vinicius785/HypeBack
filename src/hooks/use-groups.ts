/**
 * Hooks React Query dos Grupos da Comunidade — escopo **global (super-admin)**.
 *
 * Diferente das Lives (workspace-scoped), as chaves NÃO são escopadas por
 * workspace: as rotas operam em escopo global (`PlatformAdminGuard`), então o
 * cache é compartilhado entre workspaces sem risco de vazamento de dados de
 * cliente.
 *
 * Contrato: backend-community-groups-spec.md (§4).
 */
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  addGroupModerator,
  createGroup,
  createGroupPost,
  deleteGroup,
  deleteGroupPost,
  getGroup,
  listGroupPosts,
  listGroups,
  removeGroupModerator,
  updateGroup,
  uploadCommunityVideo,
  uploadGroupCover,
} from "@/shared/services/groups";
import type { CreateGroupPostPayload } from "@/shared/services/groups";
import type {
  CreateGroupPayload,
  GroupStatusFilter,
  UpdateGroupPayload,
} from "@/shared/types";

const LIST_PAGE_SIZE = 20;
const POSTS_PAGE_SIZE = 20;

export const groupKeys = {
  all: ["admin-groups"] as const,
  list: (status: GroupStatusFilter, search: string) =>
    ["admin-groups", "list", status, search] as const,
  detail: (id: string) => ["admin-groups", "detail", id] as const,
  posts: (id: string) => ["admin-groups", "posts", id] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Lista paginada por cursor. Use `fetchNextPage`/`hasNextPage` p/ "carregar mais". */
export function useGroups(
  params: {
    status?: GroupStatusFilter;
    search?: string;
    enabled?: boolean;
  } = {},
) {
  const status = params.status ?? "active";
  const search = params.search ?? "";
  return useInfiniteQuery({
    queryKey: groupKeys.list(status, search),
    queryFn: ({ pageParam }) =>
      listGroups({
        status,
        search: search || undefined,
        cursor: pageParam,
        limit: LIST_PAGE_SIZE,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) =>
      last.meta.has_more ? last.meta.next_cursor : undefined,
    enabled: params.enabled ?? true,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useGroup(
  id: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: groupKeys.detail(id ?? ""),
    queryFn: () => getGroup(id as string),
    enabled: (options.enabled ?? true) && !!id,
    staleTime: 15 * 1000,
    refetchOnWindowFocus: false,
  });
}

/** Posts do grupo (moderação de conteúdo) — paginado por cursor. */
export function useGroupPosts(
  id: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  return useInfiniteQuery({
    queryKey: groupKeys.posts(id ?? ""),
    queryFn: ({ pageParam }) =>
      listGroupPosts(id as string, { cursor: pageParam, limit: POSTS_PAGE_SIZE }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) =>
      last.meta.has_more ? last.meta.next_cursor : undefined,
    enabled: (options.enabled ?? true) && !!id,
    staleTime: 15 * 1000,
    refetchOnWindowFocus: false,
  });
}

// ---------------------------------------------------------------------------
// Mutations — CRUD
// ---------------------------------------------------------------------------

/**
 * Upload de imagem (deferido). Mesma rota serve capa do grupo (`cover_url`) e
 * imagem de post (`image_url`) — envie o arquivo e use a `url` retornada.
 */
/**
 * Upload do vídeo do post. Mutation separada da capa para o composer conseguir
 * mostrar "enviando vídeo..." (que demora bem mais) sem confundir com a imagem.
 */
export function useUploadGroupVideo() {
  return useMutation({
    mutationFn: (file: File) => uploadCommunityVideo(file),
  });
}

export function useUploadGroupCover() {
  return useMutation({
    mutationFn: (file: File) => uploadGroupCover(file),
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateGroupPayload) => createGroup(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: groupKeys.all }),
  });
}

export function useUpdateGroup(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateGroupPayload) => updateGroup(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.all });
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(id) });
    },
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteGroup(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: groupKeys.all }),
  });
}

// ---------------------------------------------------------------------------
// Mutations — moderadores (§4.6)
// ---------------------------------------------------------------------------

export function useAddGroupModerator(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => addGroupModerator(id, userId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(id) }),
  });
}

export function useRemoveGroupModerator(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => removeGroupModerator(id, userId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(id) }),
  });
}

// ---------------------------------------------------------------------------
// Mutations — moderação de conteúdo (§4.7)
// ---------------------------------------------------------------------------

export function useDeleteGroupPost(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => deleteGroupPost(id, postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.posts(id) });
      // posts_count muda → revalida lista/detalhe.
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: groupKeys.all });
    },
  });
}

/**
 * Publica um conteúdo no grupo pelo backoffice (§4.7).
 *
 * Invalida a lista de posts (o novo item entra no topo) e detalhe/listagem,
 * porque `posts_count` muda.
 */
export function useCreateGroupPost(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateGroupPostPayload) => createGroupPost(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.posts(id) });
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: groupKeys.all });
    },
  });
}
