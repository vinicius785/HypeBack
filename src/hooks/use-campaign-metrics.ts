import { useQuery } from "@tanstack/react-query";
import {
  getCampaignMetrics,
  getInfluencerMetrics,
  getContentMetrics,
  getIdentifiedPosts,
  getCampaignContentsMetricsMap,
  getCampaignTopCities,
  getCampaignAudienceByAge,
} from "@/shared/services/metrics";
import {
  useWorkspaceQueryKey,
  withWorkspaceKey,
} from "@/hooks/use-workspace-query-key";

function resolveQueryEnabled(
  enabledOrOptions?: boolean | { enabled?: boolean }
): boolean {
  if (enabledOrOptions === undefined) return true;
  if (typeof enabledOrOptions === "object" && enabledOrOptions !== null) {
    return enabledOrOptions.enabled ?? true;
  }
  return enabledOrOptions;
}

export function useCampaignMetrics(campaignId: string) {
  const workspaceId = useWorkspaceQueryKey();
  return useQuery({
    queryKey: withWorkspaceKey(["campaigns", campaignId, "metrics"], workspaceId),
    queryFn: () => getCampaignMetrics(campaignId),
    enabled: !!campaignId && !!workspaceId,
  });
}

/** Mapa em lote: GET .../metrics/contents */
export function useCampaignContentsMetricsMap(campaignId: string, enabled = true) {
  const workspaceId = useWorkspaceQueryKey();
  return useQuery({
    queryKey: withWorkspaceKey(
      ["campaigns", campaignId, "metrics", "contents-map"],
      workspaceId,
    ),
    queryFn: () => getCampaignContentsMetricsMap(campaignId),
    enabled: !!campaignId && !!workspaceId && enabled,
    staleTime: 30_000,
  });
}

/** GET .../metrics/top-cities */
export function useCampaignTopCities(
  campaignId: string,
  limit = 5,
  enabledOrOptions?: boolean | { enabled?: boolean }
) {
  const enabled = resolveQueryEnabled(enabledOrOptions);
  const workspaceId = useWorkspaceQueryKey();
  return useQuery({
    queryKey: withWorkspaceKey(
      ["campaigns", campaignId, "metrics", "top-cities", limit],
      workspaceId,
    ),
    queryFn: () => getCampaignTopCities(campaignId, limit),
    enabled: !!campaignId && !!workspaceId && enabled,
    staleTime: 30_000,
  });
}

/** GET .../metrics/audience-by-age */
export function useCampaignAudienceByAge(
  campaignId: string,
  enabledOrOptions?: boolean | { enabled?: boolean }
) {
  const enabled = resolveQueryEnabled(enabledOrOptions);
  const workspaceId = useWorkspaceQueryKey();
  return useQuery({
    queryKey: withWorkspaceKey(
      ["campaigns", campaignId, "metrics", "audience-by-age"],
      workspaceId,
    ),
    queryFn: () => getCampaignAudienceByAge(campaignId),
    enabled: !!campaignId && !!workspaceId && enabled,
    staleTime: 30_000,
  });
}

export function useInfluencerMetrics(campaignId: string) {
  const workspaceId = useWorkspaceQueryKey();
  return useQuery({
    queryKey: withWorkspaceKey(
      ["campaigns", campaignId, "metrics", "influencers"],
      workspaceId,
    ),
    queryFn: () => getInfluencerMetrics(campaignId),
    enabled: !!campaignId && !!workspaceId,
  });
}

export function useContentMetrics(
  campaignId: string,
  contentId: string,
  options?: { enabled?: boolean }
) {
  const workspaceId = useWorkspaceQueryKey();
  return useQuery({
    queryKey: withWorkspaceKey(
      ["campaigns", campaignId, "metrics", "contents", contentId],
      workspaceId,
    ),
    queryFn: () => getContentMetrics(campaignId, contentId),
    enabled:
      (options?.enabled ?? true) && !!campaignId && !!contentId && !!workspaceId,
  });
}

/** Métricas por conteúdo (lote) — mesmo cache que useCampaignContentsMetricsMap */
export function useCampaignTabContentsMetrics(
  campaignId: string,
  options?: { enabled?: boolean }
) {
  return useCampaignContentsMetricsMap(campaignId, options?.enabled ?? true);
}

export function useIdentifiedPosts(
  campaignId: string,
  filters?: { phase_id?: string }
) {
  const workspaceId = useWorkspaceQueryKey();
  return useQuery({
    queryKey: withWorkspaceKey(
      ["campaigns", campaignId, "identified-posts", filters],
      workspaceId,
    ),
    queryFn: () => getIdentifiedPosts(campaignId, filters),
    enabled: !!campaignId && !!workspaceId,
  });
}

