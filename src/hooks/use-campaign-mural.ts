import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getMuralStatus,
  activateMural,
  deactivateMural,
  type ActivateMuralData,
} from "@/shared/services/mural";
import {
  useWorkspaceQueryKey,
  withWorkspaceKey,
} from "@/hooks/use-workspace-query-key";

export function useMuralStatus(campaignId: string) {
  const workspaceId = useWorkspaceQueryKey();
  return useQuery({
    queryKey: withWorkspaceKey(
      ["campaigns", campaignId, "mural", "status"],
      workspaceId,
    ),
    queryFn: () => getMuralStatus(campaignId),
    enabled: !!campaignId && !!workspaceId,
    staleTime: 10000, // 10 segundos
    refetchInterval: 30000, // Refetch a cada 30 segundos
  });
}

export function useActivateMural(campaignId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ActivateMuralData) => activateMural(campaignId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["campaigns", campaignId, "mural"],
      });
    },
  });
}

export function useDeactivateMural(campaignId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deactivateMural(campaignId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["campaigns", campaignId, "mural"],
      });
    },
  });
}

