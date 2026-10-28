import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCampaignPhases,
  createCampaignPhase,
  updateCampaignPhase,
  deleteCampaignPhase,
  type CreatePhaseData,
  type UpdatePhaseData,
} from "@/shared/services/phase";
import {
  useWorkspaceQueryKey,
  withWorkspaceKey,
} from "@/hooks/use-workspace-query-key";

export function useCampaignPhases(campaignId: string) {
  const workspaceId = useWorkspaceQueryKey();
  return useQuery({
    queryKey: withWorkspaceKey(["campaigns", campaignId, "phases"], workspaceId),
    queryFn: () => getCampaignPhases(campaignId),
    enabled: !!campaignId && !!workspaceId,
    staleTime: 30000, // 30 segundos
  });
}

export function useCreateCampaignPhase(campaignId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePhaseData) =>
      createCampaignPhase(campaignId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["campaigns", campaignId, "phases"],
      });
      queryClient.invalidateQueries({
        queryKey: ["campaigns", campaignId],
      });
    },
  });
}

export function useUpdateCampaignPhase(campaignId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      phaseId,
      data,
    }: {
      phaseId: string;
      data: UpdatePhaseData;
    }) => updateCampaignPhase(campaignId, phaseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["campaigns", campaignId, "phases"],
      });
      queryClient.invalidateQueries({
        queryKey: ["campaigns", campaignId],
      });
    },
  });
}

export function useDeleteCampaignPhase(campaignId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (phaseId: string) =>
      deleteCampaignPhase(campaignId, phaseId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["campaigns", campaignId, "phases"],
      });
      queryClient.invalidateQueries({
        queryKey: ["campaigns", campaignId],
      });
    },
  });
}

