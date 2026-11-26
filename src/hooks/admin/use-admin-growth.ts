/**
 * Consultas do dashboard de crescimento (`/admin/dashboard/growth/*`): uma por bloco, todas independentes (uma que falha
 * mostra o próprio erro sem derrubar as outras) e na política do Admin de `use-admin-queries` (sem retry em 4xx, sem
 * `refetchOnWindowFocus`).
 *
 * São fotos de agora, calculadas no servidor com cache de 5 minutos: aqui o dado vale 5 minutos e não se atualiza sozinho.
 * `enabled` deixa a tela carregar por aba: o engajamento é a consulta mais pesada e só sai ao abrir "Criadores".
 * As chaves ficam sob `['admin','platform','growth', …]`.
 */
import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query";

import { adminGetStamped } from "@/lib/admin/admin-client";
import type {
  GrowthActive,
  GrowthApplications,
  GrowthBase,
  GrowthEngagement,
  GrowthFunnel,
  GrowthGranularity,
  GrowthNeverApplied,
  GrowthProfile,
  GrowthStamped,
  GrowthTimeline,
  GrowthTrend,
} from "@/shared/admin-growth.types";

import { adminKeys } from "./admin-query-keys";
import { adminRetry } from "./use-admin-queries";

export const GROWTH_STALE_MS = 5 * 60_000;
const BASE_PATH = "/admin/dashboard/growth";

export const GROWTH_PERIODS_MIN = 1;
export const GROWTH_PERIODS_MAX = 36;
export const ENGAGEMENT_DAYS_MIN = 1;
export const ENGAGEMENT_DAYS_MAX = 90;
export const ENGAGEMENT_DAYS_DEFAULT = 30;

type Options = { enabled?: boolean };

function useGrowth<T>(
  name: string,
  params: Record<string, string | number> | undefined,
  { enabled = true }: Options,
  keepPrevious = false,
): UseQueryResult<GrowthStamped<T>, unknown> {
  return useQuery({
    queryKey: adminKeys.of("growth", name, params ?? {}),
    queryFn: ({ signal }) => adminGetStamped<T>(`${BASE_PATH}/${name}`, params, { signal }),
    enabled,
    retry: adminRetry,
    refetchOnWindowFocus: false,
    staleTime: GROWTH_STALE_MS,
    placeholderData: keepPrevious ? keepPreviousData : undefined,
  });
}

/** `growth/base`: criadas, concluídas e ativas. */
export const useGrowthBase = (o: Options = {}) => useGrowth<GrowthBase>("base", undefined, o);

/** `growth/active`: ativos em 24h, 7, 15, 30 e 90 dias. */
export const useGrowthActive = (o: Options = {}) => useGrowth<GrowthActive>("active", undefined, o);

/** `growth/timeline`: do mais antigo ao mais novo; trocar a granularidade mantém o gráfico anterior até o novo chegar. */
export function useGrowthTimeline(granularity: GrowthGranularity, periods: number, o: Options = {}) {
  const clamped = Math.min(GROWTH_PERIODS_MAX, Math.max(GROWTH_PERIODS_MIN, Math.round(periods)));
  return useGrowth<GrowthTimeline>("timeline", { granularity, periods: clamped }, o, true);
}

/** `growth/trend`: quatro semanas fechadas e o veredito. */
export const useGrowthTrend = (o: Options = {}) => useGrowth<GrowthTrend>("trend", undefined, o);

/** `growth/funnel`. */
export const useGrowthFunnel = (o: Options = {}) => useGrowth<GrowthFunnel>("funnel", undefined, o);

/** `growth/applications`. */
export const useGrowthApplications = (o: Options = {}) => useGrowth<GrowthApplications>("applications", undefined, o);

/** `growth/engagement?days`: a consulta mais pesada do painel; ligue `enabled` só quando a aba estiver aberta. */
export function useGrowthEngagement(days: number, o: Options = {}) {
  const clamped = Math.min(ENGAGEMENT_DAYS_MAX, Math.max(ENGAGEMENT_DAYS_MIN, Math.round(days)));
  return useGrowth<GrowthEngagement>("engagement", { days: clamped }, o, true);
}

/** `growth/never-applied`. */
export const useGrowthNeverApplied = (o: Options = {}) => useGrowth<GrowthNeverApplied>("never-applied", undefined, o);

/** `growth/profile`. */
export const useGrowthProfile = (o: Options = {}) => useGrowth<GrowthProfile>("profile", undefined, o);
