/**
 * Sentinela de segurança do Admin: caixa de alertas, lista de contas vigiadas e o número do sino
 * (`/admin/security/*`). Tudo é exclusivo do administrador da plataforma; a API recusa os demais papéis com 403.
 *
 * Estas rotas não usam `Idempotency-Key` (`adminPostPlain` / `adminDelete`). A política de cache e de retry é a de
 * `use-admin-queries`; depois de qualquer escrita o recurso inteiro (`security`) é invalidado, o que atualiza a
 * lista, a contagem do sino e os vigiados de uma vez.
 *
 * Privacidade: nada aqui escreve e-mail em log ou em ferramenta de métricas.
 */
import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData, type UseInfiniteQueryResult } from "@tanstack/react-query";

import { useAuth } from "@/contexts/auth-context";
import {
  adminDelete,
  adminGetEnvelope,
  adminPath,
  adminPostPlain,
  type AdminEnvelope,
} from "@/lib/admin/admin-client";
import { isPlatformAdmin } from "@/lib/utils/platform-admin";
import type {
  SecurityAlert,
  SecurityAlertSeenBody,
  SecurityAlertsMeta,
  SecurityAlertsSummary,
  SecurityAlertStatus,
  SecurityWatch,
  SecurityWatchBody,
  SecurityWatchCreated,
} from "@/shared/admin-platform.types";

import { adminKeys } from "./admin-query-keys";
import { adminRetry, useAdminItem } from "./use-admin-queries";

export const ADMIN_SECURITY_RESOURCE = "security";

/** Quantos alertas vêm por página no "Carregar mais". */
export const SECURITY_ALERTS_PAGE_SIZE = 50;

/** O sino se atualiza a cada 60 s (e o React Query pausa o intervalo enquanto a aba está escondida). */
export const SECURITY_SUMMARY_REFRESH_MS = 60_000;

const BASE = "/admin/security";

/** Só o administrador da plataforma usa a sentinela: os outros papéis nem chegam a pedir. */
export function useCanUseSecurity(): boolean {
  const { user } = useAuth();
  return isPlatformAdmin(user);
}

/** Alertas novos, para o sino (`GET alerts/summary`). Sem `enabled`, só o administrador consulta. */
export function useSecuritySummary(options: { enabled?: boolean } = {}) {
  const canUse = useCanUseSecurity();
  return useAdminItem<SecurityAlertsSummary>({
    resource: ADMIN_SECURITY_RESOURCE,
    scope: ["summary"],
    path: `${BASE}/alerts/summary`,
    enabled: canUse && (options.enabled ?? true),
    staleTime: 10_000,
    refetchInterval: SECURITY_SUMMARY_REFRESH_MS,
  });
}

type AlertsPage = AdminEnvelope<SecurityAlert[], SecurityAlertsMeta>;

/** Alertas, mais recentes primeiro. `status`: `unseen` (padrão da tela) ou `all`. Paginação por `limit`/`offset`. */
export function useSecurityAlerts(status: SecurityAlertStatus): UseInfiniteQueryResult<InfiniteData<AlertsPage, number>, unknown> {
  return useInfiniteQuery({
    queryKey: adminKeys.of(ADMIN_SECURITY_RESOURCE, "alerts", status),
    queryFn: async ({ pageParam, signal }): Promise<AlertsPage> => {
      const page = await adminGetEnvelope<SecurityAlert[], SecurityAlertsMeta>(
        `${BASE}/alerts`,
        { status, limit: SECURITY_ALERTS_PAGE_SIZE, offset: pageParam },
        { signal },
      );
      return { data: Array.isArray(page.data) ? page.data : [], meta: page.meta };
    },
    initialPageParam: 0,
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((sum, page) => sum + page.data.length, 0);
      const total = last.meta?.total ?? 0;
      return last.data.length > 0 && loaded < total ? loaded : undefined;
    },
    retry: adminRetry,
    refetchOnWindowFocus: false,
    staleTime: 15_000,
  });
}

/** Contas vigiadas (ativas e inativas). A ordem (ativos primeiro) é da tela. */
export function useSecurityWatchlist() {
  return useAdminItem<SecurityWatch[]>({
    resource: ADMIN_SECURITY_RESOURCE,
    scope: ["watchlist"],
    path: `${BASE}/watchlist`,
  });
}

function useSecurityMutation<TData, TVariables>(mutationFn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient();
  return useMutation<TData, unknown, TVariables>({
    mutationFn,
    // Mesmo quando falha (ex.: o alerta já foi visto em outra aba) a lista é recarregada, para mostrar o estado real.
    onSettled: () => queryClient.invalidateQueries({ queryKey: adminKeys.resource(ADMIN_SECURITY_RESOURCE) }),
  });
}

export function securityAlertSeenPath(alertId: number): string {
  return `${BASE}${adminPath`/alerts/${alertId}/seen`}`;
}

export function securityWatchPath(watchId: number): string {
  return `${BASE}${adminPath`/watchlist/${watchId}`}`;
}

/** `POST alerts/:alertId/seen` — a anotação é opcional (até 500). */
export function useMarkAlertSeen() {
  return useSecurityMutation<{ id: number }, { alertId: number; note?: string }>(({ alertId, note }) => {
    const text = note?.trim();
    const body: SecurityAlertSeenBody | undefined = text ? { note: text } : undefined;
    return adminPostPlain<{ id: number }>(securityAlertSeenPath(alertId), body);
  });
}

/** `POST alerts/seen-all` — sem corpo. */
export function useMarkAllAlertsSeen() {
  return useSecurityMutation<{ marked: number }, void>(() => adminPostPlain<{ marked: number }>(`${BASE}/alerts/seen-all`));
}

/** `POST watchlist` — 409 `WATCH_ALREADY_ACTIVE` quando o e-mail já é vigiado. */
export function useWatchEmail() {
  return useSecurityMutation<SecurityWatchCreated, SecurityWatchBody>((body) =>
    adminPostPlain<SecurityWatchCreated>(`${BASE}/watchlist`, { email: body.email.trim().toLowerCase(), reason: body.reason.trim() }),
  );
}

/** `DELETE watchlist/:watchId` — para de vigiar; a linha fica inativa como histórico. */
export function useStopWatching() {
  return useSecurityMutation<{ id: number }, number>((watchId) => adminDelete<{ id: number }>(securityWatchPath(watchId)));
}
