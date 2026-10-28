import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bulkApproveInfluencers, bulkRejectInfluencers } from "@/shared/services/influencer";
import { invalidateCampaignTaskBoards } from "@/hooks/use-invalidate-task-boards";
import { toast } from "sonner";

interface BulkInfluencerActionsParams {
  campaignId: string;
}

export function useBulkInfluencerActions({ campaignId }: BulkInfluencerActionsParams) {
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: ({ influencerIds, feedback, network_id }: { influencerIds: string[]; feedback?: string; network_id?: number | string }) =>
      bulkApproveInfluencers(campaignId, influencerIds, feedback, network_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId, "users"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId, "influencers"] });
      invalidateCampaignTaskBoards(queryClient, campaignId);
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId, "inscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId, "curation"] });
      toast.success("Influenciadores aprovados com sucesso");
    },
    onError: (error: Error) => {
      const message = error?.message || "Erro ao aprovar influenciadores";
      toast.error(message);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ influencerIds, feedback, network_id }: { influencerIds: string[]; feedback: string; network_id?: number | string }) =>
      bulkRejectInfluencers(campaignId, influencerIds, feedback, network_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId, "users"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId, "influencers"] });
      invalidateCampaignTaskBoards(queryClient, campaignId);
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId, "inscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId, "curation"] });
      toast.success("Influenciadores reprovados com sucesso");
    },
    onError: (error: Error) => {
      const message = error?.message || "Erro ao reprovar influenciadores";
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

