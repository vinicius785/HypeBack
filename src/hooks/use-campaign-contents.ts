import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCampaignContents,
  approveContent,
  rejectContent,
  type ApproveContentData,
  type RejectContentData,
} from "@/shared/services/content";
import {
  useWorkspaceQueryKey,
  withWorkspaceKey,
} from "@/hooks/use-workspace-query-key";
import { invalidateCampaignTaskBoards } from "@/hooks/use-invalidate-task-boards";

export function useCampaignContents(
  campaignId: string,
  filters?: { status?: string; phase_id?: string }
) {
  const workspaceId = useWorkspaceQueryKey();
  return useQuery({
    queryKey: withWorkspaceKey(
      ["campaigns", campaignId, "contents", filters],
      workspaceId,
    ),
    queryFn: () => getCampaignContents(campaignId, filters),
    enabled: !!campaignId && !!workspaceId,
  });
}

export function useApproveContent(campaignId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ApproveContentData) =>
      approveContent(campaignId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["campaigns", campaignId, "contents"],
      });
      invalidateCampaignTaskBoards(queryClient, campaignId);
    },
  });
}

export function useRejectContent(campaignId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RejectContentData) => rejectContent(campaignId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["campaigns", campaignId, "contents"],
      });
      invalidateCampaignTaskBoards(queryClient, campaignId);
    },
  });
}

