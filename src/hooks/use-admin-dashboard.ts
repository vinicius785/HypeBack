import { useQuery } from "@tanstack/react-query";

import {
  fetchAdminCampaignsStats,
  fetchAdminCreatorsStats,
  fetchAdminDashboardSummary,
  fetchAdminFinancialStats,
  fetchAdminGeoDistribution,
  fetchAdminNicheDistribution,
  fetchAdminSaasMetrics,
  fetchAdminSizeDistribution,
  fetchAdminWorkspaceRanking,
  type AdminWorkspaceRankingSort,
} from "@/shared/services/admin-dashboard";
import type { AdminGranularity, AdminPeriod } from "@/shared/types";

/**
 * Query keys do admin dashboard.
 * Prefixo `admin` separa o cache das queries workspace-scoped — evita
 * invalidação cruzada com `["campaigns", ...]`, `["balance", ...]`, etc.
 */
export const adminQueryKeys = {
  all: ["admin"] as const,
  summary: (period: AdminPeriod) =>
    ["admin", "dashboard", "summary", period.from, period.to] as const,
  creatorsStats: (period: AdminPeriod, granularity: AdminGranularity) =>
    ["admin", "creators", "stats", period.from, period.to, granularity] as const,
  nicheDistribution: (period: AdminPeriod, limit: number) =>
    ["admin", "creators", "niche", period.from, period.to, limit] as const,
  sizeDistribution: (period: AdminPeriod) =>
    ["admin", "creators", "size", period.from, period.to] as const,
  campaignStats: (period: AdminPeriod, granularity: AdminGranularity) =>
    ["admin", "campaigns", "stats", period.from, period.to, granularity] as const,
  financialStats: (period: AdminPeriod, granularity: AdminGranularity) =>
    ["admin", "financial", "stats", period.from, period.to, granularity] as const,
  saasMetrics: (period: AdminPeriod) =>
    ["admin", "saas", "metrics", period.from, period.to] as const,
  workspaceRanking: (
    period: AdminPeriod,
    sortBy: AdminWorkspaceRankingSort,
    limit: number,
  ) =>
    [
      "admin",
      "workspaces",
      "ranking",
      period.from,
      period.to,
      sortBy,
      limit,
    ] as const,
  geoDistribution: (period: AdminPeriod) =>
    ["admin", "creators", "geo", period.from, period.to] as const,
};

/**
 * Refetch intervals por tipo de métrica.
 * Saldo em custódia e financeiros são realtime → 5 min.
 * Demais (criadores, SaaS) variam pouco → 15 min.
 */
const REFETCH_REALTIME = 5 * 60 * 1000;
const REFETCH_SLOW = 15 * 60 * 1000;
const STALE_TIME = 60 * 1000;

interface UseAdminQueryOptions {
  enabled?: boolean;
}

export function useAdminDashboardSummary(
  period: AdminPeriod,
  options: UseAdminQueryOptions = {},
) {
  return useQuery({
    queryKey: adminQueryKeys.summary(period),
    queryFn: () => fetchAdminDashboardSummary(period),
    enabled: options.enabled ?? true,
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_REALTIME,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useAdminCreatorsStats(
  period: AdminPeriod,
  granularity: AdminGranularity = "week",
  options: UseAdminQueryOptions = {},
) {
  return useQuery({
    queryKey: adminQueryKeys.creatorsStats(period, granularity),
    queryFn: () => fetchAdminCreatorsStats(period, granularity),
    enabled: options.enabled ?? true,
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_SLOW,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useAdminNicheDistribution(
  period: AdminPeriod,
  limit = 8,
  options: UseAdminQueryOptions = {},
) {
  return useQuery({
    queryKey: adminQueryKeys.nicheDistribution(period, limit),
    queryFn: () => fetchAdminNicheDistribution(period, limit),
    enabled: options.enabled ?? true,
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_SLOW,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useAdminSizeDistribution(
  period: AdminPeriod,
  options: UseAdminQueryOptions = {},
) {
  return useQuery({
    queryKey: adminQueryKeys.sizeDistribution(period),
    queryFn: () => fetchAdminSizeDistribution(period),
    enabled: options.enabled ?? true,
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_SLOW,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useAdminCampaignsStats(
  period: AdminPeriod,
  granularity: AdminGranularity = "month",
  options: UseAdminQueryOptions = {},
) {
  return useQuery({
    queryKey: adminQueryKeys.campaignStats(period, granularity),
    queryFn: () => fetchAdminCampaignsStats(period, granularity),
    enabled: options.enabled ?? true,
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_SLOW,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useAdminFinancialStats(
  period: AdminPeriod,
  granularity: AdminGranularity = "month",
  options: UseAdminQueryOptions = {},
) {
  return useQuery({
    queryKey: adminQueryKeys.financialStats(period, granularity),
    queryFn: () => fetchAdminFinancialStats(period, granularity),
    enabled: options.enabled ?? true,
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_REALTIME,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useAdminSaasMetrics(
  period: AdminPeriod,
  options: UseAdminQueryOptions = {},
) {
  return useQuery({
    queryKey: adminQueryKeys.saasMetrics(period),
    queryFn: () => fetchAdminSaasMetrics(period),
    enabled: options.enabled ?? true,
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_SLOW,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useAdminWorkspaceRanking(
  period: AdminPeriod,
  sortBy: AdminWorkspaceRankingSort = "campaigns",
  limit = 10,
  options: UseAdminQueryOptions = {},
) {
  return useQuery({
    queryKey: adminQueryKeys.workspaceRanking(period, sortBy, limit),
    queryFn: () => fetchAdminWorkspaceRanking(period, sortBy, limit),
    enabled: options.enabled ?? true,
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_SLOW,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useAdminGeoDistribution(
  period: AdminPeriod,
  options: UseAdminQueryOptions = {},
) {
  return useQuery({
    queryKey: adminQueryKeys.geoDistribution(period),
    queryFn: () => fetchAdminGeoDistribution(period),
    enabled: options.enabled ?? true,
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_SLOW,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
