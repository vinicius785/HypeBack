import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  RateLimitError,
  getInfluencerMessages,
  sendMessage,
  type SendMessageData,
} from "@/shared/services/chat";
import {
  useWorkspaceQueryKey,
  withWorkspaceKey,
} from "@/hooks/use-workspace-query-key";

/** Intervalo entre consultas do chat aberto (era 10 s e estourava o limite de requisições). */
export const CHAT_POLL_MS = 30_000;
/** Piso da espera depois de um 429, mesmo que o Retry-After seja menor. */
const RATE_LIMIT_MIN_WAIT_MS = 60_000;

const tabVisible = () => typeof document === "undefined" || document.visibilityState === "visible";

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
    staleTime: 15_000,
    // Só o chat aberto consulta (este hook só roda na conversa aberta), só com a aba visível e sem pressa: em 429 espera o
    // que a API pediu (Retry-After) antes de tentar de novo. O React Query não dispara outra consulta enquanto uma anterior
    // está em andamento.
    refetchInterval: (query) => {
      if (!tabVisible()) return false;
      const err = query.state.error;
      if (err instanceof RateLimitError) return Math.max(err.retryAfterMs, RATE_LIMIT_MIN_WAIT_MS);
      return CHAT_POLL_MS;
    },
    refetchIntervalInBackground: false,
    retry: (failures, err) => !(err instanceof RateLimitError) && failures < 2,
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

