/**
 * "Perfil da base" dos criadores (nichos e porte): lê as duas rotas do Dashboard antigo, que não estão na tabela
 * `ADMIN_ENDPOINTS` do contrato novo, mas agora pelo cliente do Admin (`adminGet`): o 401 chega ao
 * `useAdminSessionGuard`, o `signal` do React Query cancela a busca anterior, os erros são tipados
 * (`AdminApiError`, `ENDPOINT_UNAVAILABLE` quando a rota não existe) e o retry é o do Admin.
 *
 * Sem atualização por intervalo: a pessoa abre o perfil, olha, e o botão "Tentar de novo" cobre a falha.
 * Os hooks antigos (`use-admin-dashboard.ts`) ficam como estão.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { adminGet } from "@/lib/admin/admin-client";
import type { AdminNicheDistributionItem, AdminPeriod, AdminSizeDistributionItem } from "@/shared/types";

import { adminKeys } from "./admin-query-keys";
import { adminRetry } from "./use-admin-queries";

export const ADMIN_NICHE_DISTRIBUTION_PATH = "/admin/dashboard/creators/niche-distribution";
export const ADMIN_SIZE_DISTRIBUTION_PATH = "/admin/dashboard/creators/size-distribution";

const PROFILE_STALE_MS = 60_000;

interface ProfileQueryOptions {
  enabled?: boolean;
}

export function useAdminCreatorsNicheProfile(
  period: AdminPeriod,
  limit = 8,
  options: ProfileQueryOptions = {},
): UseQueryResult<AdminNicheDistributionItem[], unknown> {
  const params = { from: period.from, to: period.to, limit };
  return useQuery({
    queryKey: adminKeys.of("creators", "profile", "niche", params),
    queryFn: ({ signal }) => adminGet<AdminNicheDistributionItem[]>(ADMIN_NICHE_DISTRIBUTION_PATH, params, { signal }),
    retry: adminRetry,
    refetchOnWindowFocus: false,
    enabled: options.enabled ?? true,
    staleTime: PROFILE_STALE_MS,
  });
}

export function useAdminCreatorsSizeProfile(
  period: AdminPeriod,
  options: ProfileQueryOptions = {},
): UseQueryResult<AdminSizeDistributionItem[], unknown> {
  const params = { from: period.from, to: period.to };
  return useQuery({
    queryKey: adminKeys.of("creators", "profile", "size", params),
    queryFn: ({ signal }) => adminGet<AdminSizeDistributionItem[]>(ADMIN_SIZE_DISTRIBUTION_PATH, params, { signal }),
    retry: adminRetry,
    refetchOnWindowFocus: false,
    enabled: options.enabled ?? true,
    staleTime: PROFILE_STALE_MS,
  });
}
