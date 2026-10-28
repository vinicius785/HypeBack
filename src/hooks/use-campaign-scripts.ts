import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCampaignScripts,
  approveScript,
  rejectScript,
  type ApproveScriptData,
  type RejectScriptData,
} from "@/shared/services/script";
import {
  useWorkspaceQueryKey,
  withWorkspaceKey,
} from "@/hooks/use-workspace-query-key";
import { invalidateCampaignTaskBoards } from "@/hooks/use-invalidate-task-boards";

export function useCampaignScripts(
  campaignId: string,
  filters?: { status?: string; phase_id?: string }
) {
  const workspaceId = useWorkspaceQueryKey();
  return useQuery({
    queryKey: withWorkspaceKey(
      ["campaigns", campaignId, "scripts", filters],
      workspaceId,
    ),
    queryFn: () => getCampaignScripts(campaignId, filters),
    enabled: !!campaignId && !!workspaceId,
  });
}

export function useApproveScript(campaignId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ApproveScriptData) => approveScript(campaignId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["campaigns", campaignId, "scripts"],
      });
      invalidateCampaignTaskBoards(queryClient, campaignId);
    },
  });
}

export function useRejectScript(campaignId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RejectScriptData) => rejectScript(campaignId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["campaigns", campaignId, "scripts"],
      });
      invalidateCampaignTaskBoards(queryClient, campaignId);
    },
  });
}
