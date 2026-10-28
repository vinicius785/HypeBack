import { useQuery } from "@tanstack/react-query";
import {
  getInfluencersCatalog,
  getCampaignRecommendations,
  type CatalogFilters,
} from "@/shared/services/catalog";
import {
  useWorkspaceQueryKey,
  withWorkspaceKey,
} from "@/hooks/use-workspace-query-key";

export function useInfluencersCatalog(filters?: CatalogFilters) {
  const workspaceId = useWorkspaceQueryKey();
  return useQuery({
    queryKey: withWorkspaceKey(["influencers", "catalog", filters], workspaceId),
    queryFn: () => getInfluencersCatalog(filters),
    staleTime: 60000, // 1 minuto - catálogo não muda frequentemente
    enabled: !!workspaceId,
  });
}

export function useCampaignRecommendations(campaignId: string) {
  const workspaceId = useWorkspaceQueryKey();
  return useQuery({
    queryKey: withWorkspaceKey(
      ["campaigns", campaignId, "recommendations"],
      workspaceId,
    ),
    queryFn: () => getCampaignRecommendations(campaignId),
    enabled: !!campaignId && !!workspaceId,
    staleTime: 30000, // 30 segundos
  });
}

