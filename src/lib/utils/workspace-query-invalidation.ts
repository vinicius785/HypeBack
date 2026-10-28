import type { QueryClient } from "@tanstack/react-query";

/**
 * Prefixos de queryKey cujos dados dependem do header `Workspace-Id`.
 * Ao trocar de workspace, invalidamos tudo isso com refetch amplo para não reaproveitar cache de outro workspace.
 */
const WORKSPACE_SCOPED_QUERY_ROOTS = new Set([
  "campaigns",
  "influencers",
  /** `useQuery` em seleção de influenciadores (`getInfluencerProfiles`). */
  "influencer",
  "influencer-lists",
  "influencer-list",
  "notifications",
  "contract-templates",
]);

/**
 * Marca como obsoleto e dispara refetch de todas as queries escopadas ao workspace atual.
 * `refetchType: "all"` inclui queries inativas (ex.: detalhe de campanha após voltar à lista).
 */
export function invalidateWorkspaceScopedQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey;
      if (!Array.isArray(key) || key.length === 0) return false;
      return WORKSPACE_SCOPED_QUERY_ROOTS.has(String(key[0]));
    },
    refetchType: "all",
  });
}
