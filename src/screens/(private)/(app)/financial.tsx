import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { createFileRoute } from "@tanstack/react-router";

import { I } from "@/components/prototype/ui";
import {
  BalanceOverview,
  type FinancialTab,
} from "@/components/financial/balance-overview";
import {
  CampaignConsumptionSection,
  ConsumptionFilterChips,
} from "@/components/financial/campaign-consumption-section";
import { CpmSpendSection } from "@/components/financial/cpm-spend-section";
import {
  MovementFilterChips,
  MovementsSection,
  type MovementFilter,
} from "@/components/financial/movements-section";
import { TopUpModal } from "@/components/financial/top-up-modal";
import {
  useWorkspaceContext,
  useWorkspacePermissions,
} from "@/contexts/workspace-context";
import type { CampaignStatus } from "@/shared/services/balance-movements";

import "@/styles/prototype-financial.css";

/**
 * Página /financial — conciliação financeira do workspace (visual do protótipo).
 *
 * Gating:
 *  - Precisa de workspace selecionado (mesma exigência da API de balance).
 *  - Botão de depósito respeita `financial_balance_add`.
 */
export const Route = createFileRoute("/(private)/(app)/financial")({
  component: FinancialPage,
});

const TABS: { id: FinancialTab; label: string }[] = [
  { id: "mov", label: "Movimentações" },
  { id: "con", label: "Consumo por campanha" },
  { id: "cpm", label: "Campanhas CPM" },
];

function FinancialPage() {
  const { selectedWorkspace, isInitialized } = useWorkspaceContext();
  const permissions = useWorkspacePermissions();
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [tab, setTab] = useState<FinancialTab>("mov");
  const [movType, setMovType] = useState<MovementFilter>("all");
  const [status, setStatus] = useState<CampaignStatus>("active");
  const [hidden, setHidden] = useState(false);

  const segRef = useRef<HTMLDivElement>(null);
  const indRef = useRef<HTMLElement>(null);
  const moveInd = useCallback(() => {
    const on = segRef.current?.querySelector<HTMLElement>("button.on");
    const ind = indRef.current;
    if (!on || !ind) return;
    ind.style.width = `${on.offsetWidth}px`;
    ind.style.transform = `translateX(${on.offsetLeft}px)`;
  }, []);
  useLayoutEffect(() => {
    moveInd();
    window.addEventListener("resize", moveInd);
    return () => window.removeEventListener("resize", moveInd);
  }, [moveInd, tab, isInitialized, selectedWorkspace]);

  if (!isInitialized) {
    return (
      <div className="w-full min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  const canDeposit = permissions.financial_balance_add;

  const header = (
    <div className="head fade">
      <div>
        <h1>Financeiro</h1>
        <p>Saldo, reservas e pagamentos aos criadores em um só lugar.</p>
      </div>
      <div className="btns">
        <button
          type="button"
          className="btn"
          disabled={!canDeposit || !selectedWorkspace}
          title={
            canDeposit
              ? "Adicionar saldo via PIX"
              : "Você não tem permissão para adicionar saldo"
          }
          onClick={() => setTopUpOpen(true)}
        >
          <I n="plus" cls="sm" />
          Depositar
        </button>
      </div>
    </div>
  );

  if (!selectedWorkspace) {
    return (
      <div className="pv">
        <div className="wrap" style={{ maxWidth: "none" }}>
          {header}
          <div className="ov-empty big lvx-em">
            <span>
              <I n="wallet" />
            </span>
            <b>Selecione um workspace</b>
            <small>
              O saldo é por workspace. Escolha um workspace no menu superior
              para visualizar a conciliação financeira.
            </small>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="pv">
        <div className="wrap" style={{ maxWidth: "none" }}>
          {header}
          <BalanceOverview
            hidden={hidden}
            onToggleHidden={() => setHidden((h) => !h)}
            canDeposit={canDeposit}
            onDeposit={() => setTopUpOpen(true)}
            onTab={setTab}
          />
          <div className="tools fade fnx-tl">
            <div className="seg" id="fnseg" ref={segRef}>
              <i className="ind" ref={indRef} />
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={tab === t.id ? "on" : ""}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div>
              {tab === "mov" && (
                <MovementFilterChips value={movType} onChange={setMovType} />
              )}
              {tab === "con" && (
                <ConsumptionFilterChips value={status} onChange={setStatus} />
              )}
            </div>
          </div>
          <div className="fade fnx-rs" key={tab}>
            {tab === "mov" && <MovementsSection type={movType} />}
            {tab === "con" && <CampaignConsumptionSection status={status} />}
            {tab === "cpm" && <CpmSpendSection />}
          </div>
        </div>
      </div>
      {topUpOpen && (
        <TopUpModal open={topUpOpen} onClose={() => setTopUpOpen(false)} />
      )}
    </>
  );
}
