import {
  useInfiniteQuery,
  useQuery,
  type InfiniteData,
} from "@tanstack/react-query";

import {
  getCampaignConsumption,
  getCpmSpend,
  getMovements,
  type CampaignConsumptionFilters,
  type CpmSpendFilters,
  type MovementsFilters,
  type MovementsResponse,
} from "@/shared/services/balance-movements";
import { getWorkspaceId } from "@/lib/utils/api";

/**
 * Hooks de leitura para a página /financial.
 *
 * - `useMovements` usa `useInfiniteQuery` (cursor keyset) para "Carregar mais".
 * - Caches conservadores: histórico/consumo tendem a mudar com socket (futuro).
 * - Retry desligado em `enabled: false` quando não há workspace.
 */

export const BALANCE_MOVEMENTS_QUERY_KEYS = {
  all: ["balance-movements"] as const,
  movements: (workspaceId: string, filters: MovementsFilters) =>
    [
      ...BALANCE_MOVEMENTS_QUERY_KEYS.all,
      "movements",
      workspaceId,
      filters,
    ] as const,
  campaignConsumption: (
    workspaceId: string,
    filters: CampaignConsumptionFilters,
  ) =>
    [
      ...BALANCE_MOVEMENTS_QUERY_KEYS.all,
      "campaign-consumption",
      workspaceId,
      filters,
    ] as const,
  cpmSpend: (workspaceId: string, filters: CpmSpendFilters) =>
    [
      ...BALANCE_MOVEMENTS_QUERY_KEYS.all,
      "cpm-spend",
      workspaceId,
      filters,
    ] as const,
};

// ---------------------------------------------------------------------------
// Movements (infinite — cursor keyset)
// ---------------------------------------------------------------------------

type MovementsFiltersNoCursor = Omit<MovementsFilters, "cursor">;

export function useMovements(filters: MovementsFiltersNoCursor = {}) {
  const workspaceId = getWorkspaceId() ?? "";

  return useInfiniteQuery<
    MovementsResponse,
    Error,
    InfiniteData<MovementsResponse>,
    ReturnType<typeof BALANCE_MOVEMENTS_QUERY_KEYS.movements>,
    string | null
  >({
    queryKey: BALANCE_MOVEMENTS_QUERY_KEYS.movements(workspaceId, filters),
    queryFn: ({ pageParam }) =>
      getMovements(workspaceId, { ...filters, cursor: pageParam }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    enabled: !!workspaceId,
    staleTime: 15_000,
    retry: 1,
  });
}

// ---------------------------------------------------------------------------
// Campaign consumption
// ---------------------------------------------------------------------------

export function useCampaignConsumption(
  filters: CampaignConsumptionFilters = {},
) {
  const workspaceId = getWorkspaceId() ?? "";
  return useQuery({
    queryKey: BALANCE_MOVEMENTS_QUERY_KEYS.campaignConsumption(
      workspaceId,
      filters,
    ),
    queryFn: () => getCampaignConsumption(workspaceId, filters),
    enabled: !!workspaceId,
    staleTime: 30_000,
    retry: 1,
  });
}

// ---------------------------------------------------------------------------
// CPM spend
// ---------------------------------------------------------------------------

export function useCpmSpend(filters: CpmSpendFilters = {}) {
  const workspaceId = getWorkspaceId() ?? "";
  return useQuery({
    queryKey: BALANCE_MOVEMENTS_QUERY_KEYS.cpmSpend(workspaceId, filters),
    queryFn: () => getCpmSpend(workspaceId, filters),
    enabled: !!workspaceId,
    staleTime: 60_000,
    retry: 1,
  });
}
