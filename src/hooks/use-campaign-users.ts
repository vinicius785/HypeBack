import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCampaignUsers,
  updateCampaignUserStatus,
  type UpdateUserStatusData,
} from "@/shared/services/campaign-users";
import {
  useWorkspaceQueryKey,
  withWorkspaceKey,
} from "@/hooks/use-workspace-query-key";

export function useCampaignUsers(
  campaignId: string,
  options?: { enabled?: boolean }
) {
  const workspaceId = useWorkspaceQueryKey();
  const enabled =
    !!campaignId &&
    !!workspaceId &&
    (options?.enabled !== undefined ? options.enabled : true);

  return useQuery({
    queryKey: withWorkspaceKey(["campaigns", campaignId, "users"], workspaceId),
    queryFn: () => getCampaignUsers(campaignId),
    enabled,
  });
}

export function useUpdateCampaignUserStatus(campaignId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: UpdateUserStatusData }) =>
      updateCampaignUserStatus(campaignId, userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["campaigns", campaignId, "users"],
      });
      queryClient.invalidateQueries({
        queryKey: ["campaigns", campaignId, "dashboard"],
      });
      queryClient.invalidateQueries({
        queryKey: ["campaigns", campaignId, "influencers"],
      });
      queryClient.invalidateQueries({
        queryKey: ["campaigns", campaignId, "management"],
      });
      queryClient.invalidateQueries({
        queryKey: ["campaigns", campaignId, "inscriptions"],
      });
      queryClient.invalidateQueries({
        queryKey: ["campaigns", campaignId, "curation"],
      });
    },
  });
}

