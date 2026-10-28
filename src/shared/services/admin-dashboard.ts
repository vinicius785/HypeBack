import { getApiUrl, getAuthToken } from "@/lib/utils/api";
import type {
  AdminCampaignsStats,
  AdminCreatorsStats,
  AdminDashboardSummary,
  AdminFinancialStats,
  AdminGeoDistributionItem,
  AdminGranularity,
  AdminNicheDistributionItem,
  AdminPeriod,
  AdminSaasMetrics,
  AdminSizeDistributionItem,
  AdminWorkspaceRankingItem,
} from "@/shared/types";

/**
 * Service layer do Super Admin Dashboard.
 *
 * Particularidades:
 * - NÃO envia header `Workspace-Id` — endpoints operam em escopo global.
 * - Backend protege as rotas com `PlatformAdminGuard` (ver doc backend).
 * - Os endpoints retornam o payload dentro de `{ data: ... }` seguindo o padrão da API.
 * - Por enquanto o backend não existe; chamadas vão falhar com 404/401.
 *   A UI consome esses fetchers via React Query e mostra empty/error states.
 *
 * Contrato detalhado: `docs/api-super-admin-dashboard.md`.
 */

function buildHeaders(): HeadersInit {
  return {
    Accept: "application/json",
    "Client-Type": "backoffice",
    Authorization: `Bearer ${getAuthToken()}`,
    // NÃO incluir "Workspace-Id" — escopo global.
  };
}

function buildQuery(
  period: AdminPeriod,
  extras?: Record<string, string | number | undefined>,
): string {
  const params = new URLSearchParams();
  params.set("from", period.from);
  params.set("to", period.to);
  if (extras) {
    for (const [k, v] of Object.entries(extras)) {
      if (v != null && v !== "") params.set(k, String(v));
    }
  }
  return params.toString();
}

async function fetchAdmin<T>(path: string): Promise<T> {
  const res = await fetch(getApiUrl(path), {
    method: "GET",
    headers: buildHeaders(),
  });
  if (!res.ok) {
    let body: { message?: string } = {};
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    const err = new Error(
      body?.message || `Falha ao consultar ${path} (${res.status})`,
    ) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const json = (await res.json()) as { data: T };
  return json.data;
}

export function fetchAdminDashboardSummary(
  period: AdminPeriod,
): Promise<AdminDashboardSummary> {
  return fetchAdmin<AdminDashboardSummary>(
    `/admin/dashboard/summary?${buildQuery(period)}`,
  );
}

export function fetchAdminCreatorsStats(
  period: AdminPeriod,
  granularity: AdminGranularity = "week",
): Promise<AdminCreatorsStats> {
  return fetchAdmin<AdminCreatorsStats>(
    `/admin/dashboard/creators/stats?${buildQuery(period, { granularity })}`,
  );
}

export function fetchAdminNicheDistribution(
  period: AdminPeriod,
  limit = 8,
): Promise<AdminNicheDistributionItem[]> {
  return fetchAdmin<AdminNicheDistributionItem[]>(
    `/admin/dashboard/creators/niche-distribution?${buildQuery(period, { limit })}`,
  );
}

export function fetchAdminSizeDistribution(
  period: AdminPeriod,
): Promise<AdminSizeDistributionItem[]> {
  return fetchAdmin<AdminSizeDistributionItem[]>(
    `/admin/dashboard/creators/size-distribution?${buildQuery(period)}`,
  );
}

export function fetchAdminCampaignsStats(
  period: AdminPeriod,
  granularity: AdminGranularity = "month",
): Promise<AdminCampaignsStats> {
  return fetchAdmin<AdminCampaignsStats>(
    `/admin/dashboard/campaigns/stats?${buildQuery(period, { granularity })}`,
  );
}

export function fetchAdminFinancialStats(
  period: AdminPeriod,
  granularity: AdminGranularity = "month",
): Promise<AdminFinancialStats> {
  return fetchAdmin<AdminFinancialStats>(
    `/admin/dashboard/financial/stats?${buildQuery(period, { granularity })}`,
  );
}

export function fetchAdminSaasMetrics(
  period: AdminPeriod,
): Promise<AdminSaasMetrics> {
  return fetchAdmin<AdminSaasMetrics>(
    `/admin/dashboard/saas/metrics?${buildQuery(period)}`,
  );
}

export type AdminWorkspaceRankingSort =
  | "campaigns"
  | "volume"
  | "influencers";

export function fetchAdminWorkspaceRanking(
  period: AdminPeriod,
  sortBy: AdminWorkspaceRankingSort = "campaigns",
  limit = 10,
): Promise<AdminWorkspaceRankingItem[]> {
  return fetchAdmin<AdminWorkspaceRankingItem[]>(
    `/admin/dashboard/workspaces/ranking?${buildQuery(period, {
      sort_by: sortBy,
      limit,
    })}`,
  );
}

export function fetchAdminGeoDistribution(
  period: AdminPeriod,
): Promise<AdminGeoDistributionItem[]> {
  return fetchAdmin<AdminGeoDistributionItem[]>(
    `/admin/dashboard/creators/geo-distribution?${buildQuery(period)}`,
  );
}
