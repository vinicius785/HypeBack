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
    mutationFn: (input: string | { name: string; description?: string }) =>
      typeof input === "string" ? createInfluencerList(input) : createInfluencerList(input.name, input.description),
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
    mutationFn: ({ listId, name, description }: { listId: string; name: string; description?: string }) =>
      updateInfluencerList(listId, name, description),
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

/**
 * Duplica uma lista: cria "<nome> (cópia)" com a mesma descrição e adiciona os mesmos criadores
 * (a API não tem rota de cópia; usa as de sempre). Se alguma adição falhar, a lista nova fica com
 * o que deu certo e o aviso diz quantos ficaram de fora.
 */
export function useDuplicateInfluencerList() {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceQueryKey();

  return useMutation({
    mutationFn: async ({ name, description, userIds }: { name: string; description?: string | null; userIds: number[] }) => {
      const created = await createInfluencerList(`${name} (cópia)`, description ?? undefined);
      let failed = 0;
      for (let i = 0; i < userIds.length; i += 5) {
        const batch = userIds.slice(i, i + 5);
        const res = await Promise.allSettled(batch.map((id) => addToInfluencerList(created.id, id)));
        failed += res.filter((r) => r.status === "rejected").length;
      }
      return { created, failed };
    },
    onSuccess: ({ failed }) => {
      queryClient.invalidateQueries({ queryKey: withWorkspaceKey(["influencer-lists"], workspaceId) });
      if (failed > 0) toast.warning(`Lista duplicada, mas ${failed} ${failed === 1 ? "criador não entrou" : "criadores não entraram"}.`);
      else toast.success("Lista duplicada");
    },
    onError: () => toast.error("Erro ao duplicar lista"),
  });
}
