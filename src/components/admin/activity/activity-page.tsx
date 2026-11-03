import { useCallback, useMemo } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";

import { FinancialPeriodControl } from "@/components/admin/financial/financial-period-control";
import { AdminPage, AdminPageHeader, AdminTabPanel, AdminTabs, type AdminTabItem } from "@/components/admin/platform";
import { useAdminFinancialPeriod } from "@/hooks/admin/use-admin-financial-period";
import { useAdminListQueryState } from "@/hooks/admin/use-admin-list-query-state";

import { ActivityFeed } from "./activity-feed";
import { activeActivityFilterCount, ActivityFilterBar, clearActivityFilters } from "./activity-filter-bar";
import {
  ACTIVITY_FILTER_CONFIG,
  ACTIVITY_TAB_LABEL,
  ACTIVITY_TABS,
  readActivityFilters,
  readActivityTab,
  type ActivityTab,
} from "./activity-search";
import { AuditLog } from "./audit-log";

import "@/styles/admin-activity.css";

const TAB_ITEMS: readonly AdminTabItem<ActivityTab>[] = ACTIVITY_TABS.map((id) => ({ id, label: ACTIVITY_TAB_LABEL[id] }));
const TAB_PREFIX = "adm-act";

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
 * Atividades (`/admin/activity`): a linha do tempo da plataforma e as alterações administrativas (com antes e
 * depois). Aba, filtros, página e período ficam na URL.
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
        title="Atividades"
        subtitle="O que aconteceu na plataforma e quem mudou o quê, com o motivo e o antes e depois."
        actions={<FinancialPeriodControl period={period} today={today} preset={preset} onChange={setPeriod} />}
      />

      <AdminTabs tabs={TAB_ITEMS} value={tab} onChange={setTab} ariaLabel="Seções das atividades" idPrefix={TAB_PREFIX} />

      <ActivityFilterBar tab={tab} filters={filters} state={state} />

      <AdminTabPanel idPrefix={TAB_PREFIX} id="feed" active={tab === "feed"}>
        <ActivityFeed filters={filters} period={period} filtered={filtered} onClearFilters={clear} />
      </AdminTabPanel>
      <AdminTabPanel idPrefix={TAB_PREFIX} id="changes" active={tab === "changes"}>
        <AuditLog
          params={auditParams}
          page={state.page}
          setPage={state.setPage}
          setPerPage={state.setPerPage}
          filtered={filtered}
          onClearFilters={clear}
        />
      </AdminTabPanel>
    </AdminPage>
  );
}
