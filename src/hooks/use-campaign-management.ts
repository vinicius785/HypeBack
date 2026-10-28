import { useQuery } from "@tanstack/react-query";
import { getCampaignManagement } from "@/shared/services/campaign-management";
import {
  useWorkspaceQueryKey,
  withWorkspaceKey,
} from "@/hooks/use-workspace-query-key";

export function useCampaignManagement(
  campaignId: string | undefined,
  options?: { enabled?: boolean }
) {
  const workspaceId = useWorkspaceQueryKey();
  const enabled =
    !!campaignId &&
    !!workspaceId &&
    (options?.enabled !== undefined ? options.enabled : true);

  return useQuery({
    queryKey: withWorkspaceKey(
      ["campaigns", campaignId, "management"],
      workspaceId,
    ),
    queryFn: () => getCampaignManagement(campaignId!),
    enabled,
    staleTime: 30_000,
  });
}
