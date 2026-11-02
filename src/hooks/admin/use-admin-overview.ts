/**
 * Consultas do Dashboard do Admin: visão geral (números), alertas de atenção e atividade recente.
 *
 * Cada uma é independente (uma falha não derruba as outras) e segue a política do Admin de `use-admin-queries`:
 * sem retry em 4xx nem em resposta fora do contrato, sem `refetchOnWindowFocus`, o `signal` do React Query vai até o
 * `fetch`.
 *
 * - **visão geral** guarda o resultado do período anterior enquanto o novo carrega (`isPlaceholderData`): trocar de
 *   7 para 30 dias não apaga os números de posição (total de clientes, custódia), que não dependem do período; a tela
 *   só põe esqueleto nos que dependem;
 * - **alertas** NUNCA viram "tudo em ordem" por resposta torta: o que não é uma lista é erro (`INVALID_RESPONSE`);
 * - alertas e atividade são o "agora" do Dashboard e se atualizam sozinhos a cada minuto (aba em segundo plano não
 *   consulta); a visão geral muda por ação da pessoa (período) ou ao reabrir a tela.
 *
 * As chaves ficam sob `['admin','platform', <recurso>]`: `adminKeys.resource('overview' | 'health' | 'activity')` as
 * invalida depois de uma ação em outra tela. Os sufixos (`dashboard-alerts`, escopo `dashboard`) evitam dividir o cache
 * com outra tela que guarde dados de formato diferente sob o mesmo recurso.
 */
import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query";

import {
  AdminApiError,
  adminFeed,
  adminGet,
  adminGetEnvelope,
  type AdminFeedResult,
} from "@/lib/admin/admin-client";
import { periodQuery } from "@/lib/admin/period";
import type {
  AdminActivityEvent,
  AdminAlert,
  AdminDateRange,
  AdminOverview,
} from "@/shared/admin-platform.types";

import { adminKeys, cleanAdminParams } from "./admin-query-keys";
import { ADMIN_ITEM_STALE_MS, ADMIN_LIST_STALE_MS, adminRetry } from "./use-admin-queries";

/** De quanto em quanto tempo alertas e atividade se atualizam sozinhos. */
export const DASHBOARD_REFRESH_MS = 60_000;

/** Quantos eventos a "Atividade recente" mostra. */
export const RECENT_ACTIVITY_LIMIT = 8;

/** `GET /admin/overview?from&to`: todos os números do Dashboard, cada um com tipo e definição. */
export function useAdminOverview(range: AdminDateRange): UseQueryResult<AdminOverview, unknown> {
  const params = periodQuery(range);
  return useQuery({
    queryKey: adminKeys.of("overview", "item", cleanAdminParams(params)),
    queryFn: ({ signal }) => adminGet<AdminOverview>("/admin/overview", params, { signal }),
    placeholderData: keepPreviousData,
    retry: adminRetry,
    refetchOnWindowFocus: false,
    staleTime: ADMIN_ITEM_STALE_MS,
  });
}

export interface DashboardAlerts {
  alerts: AdminAlert[];
  /** Quando o servidor calculou (`meta.computed_at`). */
  computedAt: string | null;
}

function invalidResponse(reason: string): AdminApiError {
  return new AdminApiError({
    status: 200,
    code: "INVALID_RESPONSE",
    message: "O servidor respondeu em um formato inesperado.",
    details: { reason },
  });
}

/** `GET /admin/health/alerts`: alertas (fatos) e sugestões (heurísticas), sem filtro. */
export function useAdminDashboardAlerts(): UseQueryResult<DashboardAlerts, unknown> {
  return useQuery({
    queryKey: adminKeys.of("health", "dashboard-alerts"),
    queryFn: async ({ signal }): Promise<DashboardAlerts> => {
      const { data, meta } = await adminGetEnvelope<AdminAlert[], { computed_at?: unknown }>(
        "/admin/health/alerts",
        undefined,
        { signal },
      );
      // Resposta torta não pode virar a tela "tudo em ordem": para quem vigia, falso alívio é pior que erro.
      if (!Array.isArray(data)) throw invalidResponse("`data` não é uma lista");
      const computedAt = typeof meta === "object" && meta !== null && typeof meta.computed_at === "string" ? meta.computed_at : null;
      return { alerts: data, computedAt };
    },
    retry: adminRetry,
    refetchOnWindowFocus: false,
    staleTime: ADMIN_ITEM_STALE_MS,
    refetchInterval: DASHBOARD_REFRESH_MS,
  });
}

/** `GET /admin/activity?limit=8`: só a primeira página do feed (os mais recentes primeiro). */
export function useAdminRecentActivity(
  limit: number = RECENT_ACTIVITY_LIMIT,
): UseQueryResult<AdminFeedResult<AdminActivityEvent>, unknown> {
  const params = { limit };
  return useQuery({
    queryKey: adminKeys.feed("activity", params, ["dashboard"]),
    queryFn: ({ signal }) => adminFeed<AdminActivityEvent>("/admin/activity", params, { signal }),
    retry: adminRetry,
    refetchOnWindowFocus: false,
    staleTime: ADMIN_LIST_STALE_MS,
    refetchInterval: DASHBOARD_REFRESH_MS,
  });
}
