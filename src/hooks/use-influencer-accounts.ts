import { useQuery } from "@tanstack/react-query";

import { useWorkspaceQueryKey, withWorkspaceKey } from "@/hooks/use-workspace-query-key";
import { getInfluencerProfiles, type InfluencerProfile } from "@/shared/services/influencer";

/**
 * Todas as contas de rede social de um criador (`GET /influencers/:id/profiles`).
 * O catálogo pagina por conta, então as outras redes de uma pessoa podem estar
 * em páginas ainda não carregadas; esta consulta (com cache) completa a lista.
 */
export function useInfluencerAccounts(userId: number, enabled = true) {
  const workspaceId = useWorkspaceQueryKey();
  return useQuery<InfluencerProfile[]>({
    queryKey: withWorkspaceKey(["influencer-profiles", userId], workspaceId),
    queryFn: () => getInfluencerProfiles(String(userId)),
    enabled: enabled && !!workspaceId,
    staleTime: 5 * 60_000,
  });
}
