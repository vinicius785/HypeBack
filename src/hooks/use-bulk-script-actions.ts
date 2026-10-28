import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  bulkApproveScripts,
  bulkRejectScripts,
} from "@/shared/services/script";
import { invalidateCampaignTaskBoards } from "@/hooks/use-invalidate-task-boards";

interface UseBulkScriptActionsProps {
  campaignId: string;
}

export function useBulkScriptActions({
  campaignId,
}: UseBulkScriptActionsProps) {
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: (scriptIds: string[]) =>
      bulkApproveScripts(campaignId, scriptIds),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["campaigns", campaignId, "scripts"],
      });
      invalidateCampaignTaskBoards(queryClient, campaignId);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({
      scriptIds,
      feedback,
    }: {
      scriptIds: string[];
      feedback: string;
    }) => bulkRejectScripts(campaignId, scriptIds, feedback),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["campaigns", campaignId, "scripts"],
      });
      invalidateCampaignTaskBoards(queryClient, campaignId);
    },
  });

  return {
    approve: approveMutation.mutate,
    reject: rejectMutation.mutate,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
  };
}
