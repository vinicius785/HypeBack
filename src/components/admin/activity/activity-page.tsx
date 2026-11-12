import { useCallback, useMemo } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";

import { FinancialPeriodControl } from "@/components/admin/financial/financial-period-control";
import { AdminPage, AdminPageHeader, type AdminFilterOption } from "@/components/admin/platform";
import { useAdminFinancialPeriod } from "@/hooks/admin/use-admin-financial-period";
import { useAdminListQueryState } from "@/hooks/admin/use-admin-list-query-state";

import { HealthPage } from "@/components/admin/health/health-page";

import { ActivityFeed } from "./activity-feed";
import { activeActivityFilterCount, ActivityFilterBar, clearActivityFilters } from "./activity-filter-bar";
import {
  ACTIVITY_FILTER_CONFIG,
  ACTIVITY_TAB_LABEL,
  readActivityFilters,
  readActivityTab,
  type ActivityTab,
} from "./activity-search";
import { AuditLog } from "./audit-log";

import "@/styles/admin-activity.css";

const VIEW_OPTIONS: readonly AdminFilterOption[] = [
  { value: "feed", label: "Tudo na plataforma" },
  { value: "changes", label: ACTIVITY_TAB_LABEL.changes },
];

/** Aba da URL (`?tab=changes`). Trocar de aba leva o período e o workspace: valem para as duas visões. */
function useActivityTab(): [ActivityTab, (tab: ActivityTab) => void] {
  const raw = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();
  const tab = readActivityTab(raw);

  const setTab = useCallback(
    (next: ActivityTab) => {
      navigate({
        to: ".",
        search: ((prev: Record<string, unknown>) => {
          const out: Record<string, unknown> = {};
          for (const key of ["from", "to", "workspace_id"]) if (prev[key] !== undefined) out[key] = prev[key];
          if (next !== "feed") out.tab = next;
          return out;
        }) as never,
        replace: true,
        resetScroll: false,
      } as never);
    },
    [navigate],
  );

  return [tab, setTab];
}

/**
 * Monitoramento (`/admin/activity`): uma página só, sem abas. Em cima, o estado da plataforma (sistemas, alertas e
 * sugestões); embaixo, a atividade (linha do tempo ou alterações administrativas, por um seletor). Visão, filtros,
 * página e período ficam na URL.
 */
export function ActivityPage() {
  const [tab, setTab] = useActivityTab();
  const { period, today, preset, setPeriod } = useAdminFinancialPeriod();
  const state = useAdminListQueryState(ACTIVITY_FILTER_CONFIG);
  const filters = readActivityFilters(state.filters);

  const filtered = activeActivityFilterCount(tab, filters) > 0;
  const clear = () => clearActivityFilters(tab, state);

  // Só o que o contrato do log aceita, e só o que está ligado: nada de parâmetro vazio na consulta.
  const auditParams = useMemo(
    () => ({
      page: state.page,
      per_page: state.perPage,
      from: period.from,
      to: period.to,
      workspace_id: filters.workspaceId || undefined,
      action: filters.action || undefined,
      target_type: filters.targetType || undefined,
      target_id: filters.targetId || undefined,
      actor_user_id: filters.actorUserId || undefined,
    }),
    [state.page, state.perPage, period.from, period.to, filters.workspaceId, filters.action, filters.targetType, filters.targetId, filters.actorUserId],
  );

  return (
    <AdminPage>
      <AdminPageHeader
        title="Monitoramento"
        subtitle="Como a plataforma está agora, o que pede atenção e o que aconteceu."
      />

      {/* 1. Agora: sistemas, alertas e sugestões */}
      <HealthPage embedded />

      {/* 2. O que aconteceu: uma linha do tempo, com o período e o seletor de visão no mesmo lugar (sem abas) */}
      <div className="adm-mon-head">
        <div>
          <h2>Atividade</h2>
          <p>O que aconteceu na plataforma e quem mudou o quê, com o motivo e o antes e depois.</p>
        </div>
        <FinancialPeriodControl period={period} today={today} preset={preset} onChange={setPeriod} />
      </div>

      <ActivityFilterBar
        tab={tab}
        filters={filters}
        state={state}
        segment={{ options: VIEW_OPTIONS, value: tab, onChange: (value) => setTab(value as ActivityTab), ariaLabel: "O que mostrar" }}
      />

      {tab === "feed" ? (
        <ActivityFeed filters={filters} period={period} filtered={filtered} onClearFilters={clear} />
      ) : (
        <AuditLog
          params={auditParams}
          page={state.page}
          setPage={state.setPage}
          setPerPage={state.setPerPage}
          filtered={filtered}
          onClearFilters={clear}
        />
      )}
    </AdminPage>
  );
}
