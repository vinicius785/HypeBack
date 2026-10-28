import { useQuery, useQueries } from "@tanstack/react-query";
import {
  getCampaignInscriptions,
  getCampaignCuration,
  type InscriptionsSegment,
  type CurationColumn,
} from "@/shared/services/campaign-tab-influencers";
import {
  useWorkspaceQueryKey,
  withWorkspaceKey,
} from "@/hooks/use-workspace-query-key";

export function useCampaignInscriptions(
  campaignId: string | undefined,
  segment: InscriptionsSegment,
  options?: { enabled?: boolean }
) {
  const workspaceId = useWorkspaceQueryKey();
  const enabled =
    !!campaignId &&
    !!workspaceId &&
    (options?.enabled !== undefined ? options.enabled : true);

  return useQuery({
    queryKey: withWorkspaceKey(
      ["campaigns", campaignId, "inscriptions", segment],
      workspaceId,
    ),
    queryFn: () => getCampaignInscriptions(campaignId!, segment),
    enabled,
    staleTime: 30_000,
  });
}

export function useCampaignCuration(
  campaignId: string | undefined,
  column: CurationColumn,
  options?: { enabled?: boolean }
) {
  const workspaceId = useWorkspaceQueryKey();
  const enabled =
    !!campaignId &&
    !!workspaceId &&
    (options?.enabled !== undefined ? options.enabled : true);

  return useQuery({
    queryKey: withWorkspaceKey(
      ["campaigns", campaignId, "curation", column],
      workspaceId,
    ),
    queryFn: () => getCampaignCuration(campaignId!, column),
    enabled,
    staleTime: 30_000,
  });
}

const CURATION_COLUMNS = ["pending", "approved", "rejected"] as const;

/** Três queries em paralelo para contagens nas pills e listas por coluna. */
export function useCampaignCurationColumns(campaignId: string | undefined) {
  const workspaceId = useWorkspaceQueryKey();
  return useQueries({
    queries: CURATION_COLUMNS.map((column) => ({
      queryKey: withWorkspaceKey(
        ["campaigns", campaignId, "curation", column],
        workspaceId,
      ),
      queryFn: () => getCampaignCuration(campaignId!, column),
      enabled: !!campaignId && !!workspaceId,
      staleTime: 30_000,
    })),
  });
}
