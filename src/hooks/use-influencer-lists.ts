import { useMemo } from "react";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getInfluencerLists,
  getInfluencerList,
  bulkAddInfluencersToCampaign,
  type InfluencerList,
  type BulkAddInfluencersRequest,
} from "@/shared/services/influencer-lists";
import { toast } from "sonner";
import {
  useWorkspaceQueryKey,
  withWorkspaceKey,
} from "@/hooks/use-workspace-query-key";

export function useInfluencerLists() {
  const workspaceId = useWorkspaceQueryKey();
  return useQuery({
    queryKey: withWorkspaceKey(["influencer-lists"], workspaceId),
    queryFn: getInfluencerLists,
    enabled: !!workspaceId,
  });
}

/** Retorna um Map<userId, InfluencerList[]> com todas as listas que cada influenciador pertence. */
export function useInfluencerMembershipMap(): Map<number, InfluencerList[]> {
  const { data: lists = [] } = useInfluencerLists();
  const workspaceId = useWorkspaceQueryKey();

  const detailQueries = useQueries({
    queries: lists.map((list) => ({
      queryKey: withWorkspaceKey(["influencer-list", list.id], workspaceId),
      queryFn: () => getInfluencerList(list.id),
      enabled: !!workspaceId,
    })),
  });

  return useMemo(() => {
    const map = new Map<number, InfluencerList[]>();
    detailQueries.forEach((q, i) => {
      const list = lists[i];
      if (!q.data || !list) return;
      for (const inf of q.data.influencers) {
        const existing = map.get(inf.id) ?? [];
        existing.push(list);
        map.set(inf.id, existing);
      }
    });
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailQueries, lists]);
}

export function useInfluencerList(listId: string | null) {
  const workspaceId = useWorkspaceQueryKey();
  return useQuery({
    queryKey: withWorkspaceKey(["influencer-list", listId], workspaceId),
    queryFn: () => getInfluencerList(listId!),
    enabled: !!listId && !!workspaceId,
  });
}

export function useBulkAddInfluencers(campaignId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BulkAddInfluencersRequest) =>
      bulkAddInfluencersToCampaign(campaignId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId, "users"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId, "influencers"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId, "dashboard"] });
      queryClient.invalidateQueries({
        queryKey: ["campaigns", campaignId, "influencer-selection"],
      });
      toast.success("Influenciadores adicionados com sucesso");
    },
    onError: (error: Error) => {
      const message = error?.message || "Erro ao adicionar influenciadores";
      toast.error(message);
    },
  });
}

