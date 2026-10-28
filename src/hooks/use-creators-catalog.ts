import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getCreatorsCatalog,
  createInfluencerList,
  updateInfluencerList,
  deleteInfluencerList,
  addToInfluencerList,
  removeFromInfluencerList,
  type CreatorsCatalogFilters,
} from "@/shared/services/creators-catalog";
import {
  useWorkspaceQueryKey,
  withWorkspaceKey,
} from "@/hooks/use-workspace-query-key";

type CatalogQueryFilters = Omit<CreatorsCatalogFilters, "page">;

export function useCreatorsCatalog(filters: CatalogQueryFilters) {
  const workspaceId = useWorkspaceQueryKey();

  return useInfiniteQuery({
    queryKey: withWorkspaceKey(["creators-catalog", filters], workspaceId),
    queryFn: ({ pageParam }) =>
      getCreatorsCatalog({ ...filters, page: pageParam as number }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    enabled: !!workspaceId,
  });
}

export function useCreateInfluencerList() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceQueryKey();

  return useMutation({
    mutationFn: (name: string) => createInfluencerList(name),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: withWorkspaceKey(["influencer-lists"], workspaceId),
      });
      toast.success("Lista criada com sucesso");
    },
    onError: () => toast.error("Erro ao criar lista"),
  });
}

export function useUpdateInfluencerList() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceQueryKey();

  return useMutation({
    mutationFn: ({ listId, name }: { listId: string; name: string }) =>
      updateInfluencerList(listId, name),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: withWorkspaceKey(["influencer-lists"], workspaceId),
      });
      queryClient.invalidateQueries({
        queryKey: withWorkspaceKey(["influencer-list", variables.listId], workspaceId),
      });
      toast.success("Lista atualizada");
    },
    onError: () => toast.error("Erro ao atualizar lista"),
  });
}

export function useDeleteInfluencerList() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceQueryKey();

  return useMutation({
    mutationFn: (listId: string) => deleteInfluencerList(listId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: withWorkspaceKey(["influencer-lists"], workspaceId),
      });
      toast.success("Lista excluída");
    },
    onError: () => toast.error("Erro ao excluir lista"),
  });
}

export function useAddToInfluencerList() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceQueryKey();

  return useMutation({
    mutationFn: ({ listId, userId }: { listId: string; userId: number }) =>
      addToInfluencerList(listId, userId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: withWorkspaceKey(["influencer-lists"], workspaceId),
      });
      queryClient.invalidateQueries({
        queryKey: withWorkspaceKey(["influencer-list", variables.listId], workspaceId),
      });
      toast.success("Criador adicionado à lista");
    },
    onError: () => toast.error("Erro ao adicionar à lista"),
  });
}

export function useRemoveFromInfluencerList() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceQueryKey();

  return useMutation({
    mutationFn: ({ listId, userId }: { listId: string; userId: number }) =>
      removeFromInfluencerList(listId, userId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: withWorkspaceKey(["influencer-lists"], workspaceId),
      });
      queryClient.invalidateQueries({
        queryKey: withWorkspaceKey(["influencer-list", variables.listId], workspaceId),
      });
      toast.success("Criador removido da lista");
    },
    onError: () => toast.error("Erro ao remover da lista"),
  });
}
