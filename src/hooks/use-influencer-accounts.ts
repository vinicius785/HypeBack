import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";

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

/**
 * Contas de vários criadores de uma vez (mesma chave e cache de `useInfluencerAccounts`:
 * quem já foi aberto no catálogo não é buscado de novo). Devolve por `userId`.
 */
export function useInfluencerAccountsMap(userIds: number[]) {
  const workspaceId = useWorkspaceQueryKey();
  const results = useQueries({
    queries: userIds.map((userId) => ({
      queryKey: withWorkspaceKey(["influencer-profiles", userId], workspaceId),
      queryFn: () => getInfluencerProfiles(String(userId)),
      enabled: !!workspaceId,
      staleTime: 5 * 60_000,
    })),
  });
  const loading = results.some((r) => r.isLoading);
  const key = results.map((r) => r.dataUpdatedAt).join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const map = useMemo(() => new Map(userIds.map((id, i) => [id, results[i]?.data as InfluencerProfile[] | undefined])), [userIds.join(","), key]);
  return { map, loading };
}
