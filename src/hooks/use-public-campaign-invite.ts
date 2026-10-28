import { useQuery } from "@tanstack/react-query";
import { getPublicCampaignInvite } from "@/shared/services/public-campaign-invite";

export function usePublicCampaignInvite(campaignPublicId: string) {
  return useQuery({
    queryKey: ["public-campaign-invite", campaignPublicId],
    queryFn: () => getPublicCampaignInvite(campaignPublicId),
    enabled: Boolean(campaignPublicId?.trim()),
    retry: false,
    // Dados públicos estáveis: evita novo GET ao focar a aba / remontar (padrão do RQ é staleTime 0 + refetchOnWindowFocus).
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
