/**
 * Consultas da Saúde da plataforma: alertas e sugestões (`/admin/health/alerts`) e estado do sistema
 * (`/admin/health/system`). Política de cache e de erro do Admin (`use-admin-queries.ts`).
 *
 * É uma tela de acompanhamento: as duas consultas se atualizam sozinhas a cada minuto (com a aba visível) além
 * do botão "Atualizar". Os alertas precisam do `meta.computed_at` ("verificado há…"), que `useAdminItem` descarta;
 * por isso usam `adminGetEnvelope`.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { adminGetEnvelope, type AdminQuery } from "@/lib/admin/admin-client";
import type {
  AdminAlert,
  AdminAlertKind,
  AdminAlertSeverity,
  AdminAlertsResponse,
  AdminSystemHealth,
} from "@/shared/admin-platform.types";

import { adminKeys, cleanAdminParams } from "./admin-query-keys";
import { adminRetry, isSameListIdentity, useAdminItem } from "./use-admin-queries";

export const ADMIN_HEALTH_RESOURCE = "health";
/** Atualização automática da tela de saúde. */
export const ADMIN_HEALTH_REFETCH_MS = 60_000;
const HEALTH_STALE_MS = 15_000;

export interface AdminAlertsFilters {
  /** `''` = alertas e sugestões (o filtro nem é enviado). */
  kind: AdminAlertKind | "";
  /** `''` = qualquer gravidade. */
  severity: AdminAlertSeverity | "";
}

export interface AdminAlertsResult {
  alerts: AdminAlert[];
  /** Quando o servidor calculou (`meta.computed_at`). */
  computedAt: string | null;
}

/** Alertas e sugestões; os filtros vão para a API. Trocar de filtro mantém a lista anterior até a nova chegar. */
export function useAdminHealthAlerts(filters: AdminAlertsFilters) {
  const params: AdminQuery = { kind: filters.kind || undefined, severity: filters.severity || undefined };
  const queryKey = adminKeys.of(ADMIN_HEALTH_RESOURCE, "alerts", cleanAdminParams(params));
  return useQuery<AdminAlertsResult>({
    queryKey,
    queryFn: async ({ signal }) => {
      const { data, meta } = await adminGetEnvelope<AdminAlertsResponse["data"], AdminAlertsResponse["meta"]>(
        "/admin/health/alerts",
        params,
        { signal },
      );
      return { alerts: Array.isArray(data) ? data : [], computedAt: meta?.computed_at ?? null };
    },
    placeholderData: (previous, previousQuery) => (isSameListIdentity(previousQuery?.queryKey, queryKey) ? previous : undefined),
    retry: adminRetry,
    refetchOnWindowFocus: false,
    staleTime: HEALTH_STALE_MS,
    refetchInterval: ADMIN_HEALTH_REFETCH_MS,
  });
}

/** Banco, Redis, snapshot de métricas e jobs agendados (este último, "não apurado"). */
export function useAdminSystemHealth() {
  return useAdminItem<AdminSystemHealth>({
    resource: ADMIN_HEALTH_RESOURCE,
    scope: ["system"],
    path: "/admin/health/system",
    staleTime: HEALTH_STALE_MS,
    refetchInterval: ADMIN_HEALTH_REFETCH_MS,
  });
}

/** "Agora" que se renova sozinho (a cada 30 s): faz o "verificado há…" andar sem nova consulta. */
export function useHealthClock(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
