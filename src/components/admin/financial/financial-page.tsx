import { useCallback, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";

import { AdminInfoPopover, AdminPage, AdminPageHeader } from "@/components/admin/platform";
import { useAdminFinancialPeriod } from "@/hooks/admin/use-admin-financial-period";

import { FinancialByWorkspace } from "./financial-by-workspace";
import { FinancialMovements } from "./financial-movements";
import { FINANCIAL_READING_HELP } from "./financial-model";
import { FinancialOverview } from "./financial-overview";
import { FinancialIsland } from "./financial-island";
import { buildPeriodBar } from "./financial-period-filter";
import { readFinancialTab, type FinancialTab } from "./financial-search";

import "@/styles/admin-financial.css";


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
 * O período (dias de São Paulo) e a aba ficam na URL e valem para as três abas. O período é um só, no cabeçalho;
 * "Atualizar" é o ícone no fim da barra de filtros das listas e, na visão geral (que não tem barra), fica ao lado
 * do período.
 */
export function FinancialPage() {
  const [tab, setTab] = useFinancialTab();
  const { period, today, preset, setPeriod } = useAdminFinancialPeriod();
  // Onde as visões penduram a barra (período, filtros, atualizar): dentro da ilha.
  const [tools, setTools] = useState<HTMLElement | null>(null);
  const periodBar = buildPeriodBar(period, today, preset, setPeriod);

  return (
    <AdminPage>
      <AdminPageHeader
        title="Financeiro"
        subtitle={
          <>
            O dinheiro que passa pela plataforma: aportes dos clientes, custódia, repasses aos criadores e conferências.{" "}
            <AdminInfoPopover prefix="Como ler" label="Liberado e pago">
              {FINANCIAL_READING_HELP.map((text) => (
                <AdminInfoPopover.Paragraph key={text}>{text}</AdminInfoPopover.Paragraph>
              ))}
            </AdminInfoPopover>
          </>
        }
      />

      <FinancialIsland toolsRef={setTools} tab={tab} onTab={setTab} period={period} />

      {tab === "overview" ? <FinancialOverview period={period} tools={tools} periodBar={periodBar} /> : null}
      {tab === "movements" ? <FinancialMovements period={period} tools={tools} periodBar={periodBar} /> : null}
      {tab === "by-workspace" ? <FinancialByWorkspace period={period} tools={tools} periodBar={periodBar} /> : null}
    </AdminPage>
  );
}
