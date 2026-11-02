import { useCallback } from "react";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";

import { I } from "@/components/prototype/ui";
import { AdminPage, AdminPageHeader, AdminTabPanel, AdminTabs, type AdminTabItem } from "@/components/admin/platform";
import { adminKeys } from "@/hooks/admin/admin-query-keys";
import { ADMIN_FINANCIAL_RESOURCE } from "@/hooks/admin/use-admin-financial";
import { useAdminFinancialPeriod } from "@/hooks/admin/use-admin-financial-period";

import { FinancialByWorkspace } from "./financial-by-workspace";
import { FinancialMovements } from "./financial-movements";
import { FinancialOverview } from "./financial-overview";
import { FinancialPeriodSelect } from "./financial-period-select";
import { FINANCIAL_TAB_LABEL, FINANCIAL_TABS, readFinancialTab, type FinancialTab } from "./financial-search";

import "@/styles/admin-financial.css";

const TAB_ITEMS: readonly AdminTabItem<FinancialTab>[] = FINANCIAL_TABS.map((id) => ({ id, label: FINANCIAL_TAB_LABEL[id] }));
const TAB_PREFIX = "adm-fin";

/** Aba da URL (`?tab=movements`). Trocar de aba leva só o período: cada aba tem os seus filtros. */
function useFinancialTab(): [FinancialTab, (tab: FinancialTab) => void] {
  const raw = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();
  const tab = readFinancialTab(raw);

  const setTab = useCallback(
    (next: FinancialTab) => {
      navigate({
        to: ".",
        search: ((prev: Record<string, unknown>) => {
          const out: Record<string, unknown> = {};
          if (prev.from !== undefined) out.from = prev.from;
          if (prev.to !== undefined) out.to = prev.to;
          if (next !== "overview") out.tab = next;
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
 * Financeiro global (`/admin/financial`): visão geral dos números, movimentações e distribuição por workspace.
 * O período (dias de São Paulo) e a aba ficam na URL e valem para as três abas.
 */
export function FinancialPage() {
  const [tab, setTab] = useFinancialTab();
  const { period, today, preset, setPeriod } = useAdminFinancialPeriod();
  const queryClient = useQueryClient();
  const fetching = useIsFetching({ queryKey: adminKeys.resource(ADMIN_FINANCIAL_RESOURCE) }) > 0;

  return (
    <AdminPage>
      <AdminPageHeader
        title="Financeiro"
        subtitle="O dinheiro que passa pela plataforma: aportes dos clientes, custódia, repasses aos criadores e conferências."
        actions={
          <button
            type="button"
            className="btn out adm-btn-sm adm-fin-refresh"
            disabled={fetching}
            aria-busy={fetching ? true : undefined}
            onClick={() => void queryClient.invalidateQueries({ queryKey: adminKeys.resource(ADMIN_FINANCIAL_RESOURCE) })}
          >
            <I n="refresh" cls="sm" />
            {fetching ? "Atualizando…" : "Atualizar"}
          </button>
        }
      />

      <AdminTabs tabs={TAB_ITEMS} value={tab} onChange={setTab} ariaLabel="Seções do financeiro" idPrefix={TAB_PREFIX} />

      <FinancialPeriodSelect period={period} today={today} preset={preset} onChange={setPeriod} />

      <AdminTabPanel idPrefix={TAB_PREFIX} id="overview" active={tab === "overview"}>
        <FinancialOverview period={period} />
      </AdminTabPanel>
      <AdminTabPanel idPrefix={TAB_PREFIX} id="movements" active={tab === "movements"}>
        <FinancialMovements period={period} />
      </AdminTabPanel>
      <AdminTabPanel idPrefix={TAB_PREFIX} id="by-workspace" active={tab === "by-workspace"}>
        <FinancialByWorkspace period={period} />
      </AdminTabPanel>
    </AdminPage>
  );
}
