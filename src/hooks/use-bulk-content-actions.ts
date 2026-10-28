import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bulkApproveContents, bulkRejectContents } from "@/shared/services/content";
import { invalidateCampaignTaskBoards } from "@/hooks/use-invalidate-task-boards";
import { toast } from "sonner";

interface BulkContentActionsParams {
  campaignId: string;
}

export function useBulkContentActions({ campaignId }: BulkContentActionsParams) {
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: ({
      contentIds,
      data,
    }: {
      contentIds: string[];
      data?: {
        feedback?: string;
        caption_feedback?: string;
        new_submission_deadline?: string;
      };
    }) => bulkApproveContents(campaignId, contentIds, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId, "contents"] });
      invalidateCampaignTaskBoards(queryClient, campaignId);
      toast.success("Conteúdos aprovados com sucesso");
    },
    onError: (error: Error) => {
      const message = error?.message || "Erro ao aprovar conteúdos";
      toast.error(message);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({
      contentIds,
      feedback,
      caption_feedback,
      new_submission_deadline,
    }: {
      contentIds: string[];
      feedback: string;
      caption_feedback?: string;
      new_submission_deadline?: string;
    }) =>
      bulkRejectContents(
        campaignId,
        contentIds,
        feedback,
        caption_feedback || new_submission_deadline
          ? { caption_feedback, new_submission_deadline }
          : undefined
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId, "contents"] });
      invalidateCampaignTaskBoards(queryClient, campaignId);
      toast.success("Conteúdos reprovados com sucesso");
    },
    onError: (error: Error) => {
      const message = error?.message || "Erro ao reprovar conteúdos";
      toast.error(message);
    },
  });

  return {
    approve: approveMutation.mutate,
    reject: rejectMutation.mutate,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
  };
}

