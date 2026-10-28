import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getInfluencerMessages,
  sendMessage,
  type SendMessageData,
} from "@/shared/services/chat";
import {
  useWorkspaceQueryKey,
  withWorkspaceKey,
} from "@/hooks/use-workspace-query-key";

export function useInfluencerMessages(
  campaignId: string,
  influencerId: string
) {
  const workspaceId = useWorkspaceQueryKey();
  return useQuery({
    queryKey: withWorkspaceKey(
      [
        "campaigns",
        campaignId,
        "influencers",
        influencerId,
        "messages",
      ],
      workspaceId,
    ),
    queryFn: () => getInfluencerMessages(campaignId, influencerId),
    enabled: !!campaignId && !!influencerId && !!workspaceId,
    staleTime: 5000, // 5 segundos
    refetchInterval: 10000, // Refetch a cada 10 segundos para chat em tempo real
  });
}

export function useSendMessage(
  campaignId: string,
  influencerId: string
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SendMessageData) =>
      sendMessage(campaignId, influencerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          "campaigns",
          campaignId,
          "influencers",
          influencerId,
          "messages",
        ],
      });
    },
  });
}

