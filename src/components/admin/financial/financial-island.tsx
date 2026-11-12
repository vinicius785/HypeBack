import { AdminIsland, AdminIslandStat } from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { useAdminFinancialSummary } from "@/hooks/admin/use-admin-financial";
import { figureText } from "@/lib/admin/format";
import type { AdminDateRange } from "@/shared/admin-platform.types";

import { FINANCIAL_TAB_LABEL, FINANCIAL_TABS, type FinancialTab } from "./financial-search";

import "@/styles/admin-financial.css";

interface Props {
  /** Onde cada visão pendura a sua barra (período, filtros, busca, atualizar): dentro da ilha. */
  toolsRef: (element: HTMLDivElement | null) => void;
  tab: FinancialTab;
  onTab: (tab: FinancialTab) => void;
  period: AdminDateRange;
}

/**
 * "Ilha" (padrão `AdminIsland`) do Financeiro: à esquerda, as três visões (Visão geral, Movimentações, Por workspace) como
 * pílulas (a única navegação da tela); à direita, o que está em custódia e os aportes do período, com ícones animados.
 * Embaixo, a barra da visão aberta (o período é um filtro do ícone de filtro, junto dos filtros de cada visão). A seta abre uma folha com comprometido, saldo livre, disponível para
 * saque e cobranças pendentes. Os números vêm do mesmo resumo da visão geral (uma consulta só, em cache).
 */
export function FinancialIsland({ toolsRef, tab, onTab, period }: Props) {
  const summary = useAdminFinancialSummary(period);
  const figures = summary.data?.figures;
  const text = (key: keyof NonNullable<typeof figures>) => (figures ? figureText(figures[key]) : "—");

  return (
    <AdminIsland
      ariaLabel="Financeiro"
      className="isl-fin-w"
      sheetLabel="Resumo do financeiro"
      chevronLabel={{ open: "Abrir o resumo do financeiro", close: "Fechar o resumo do financeiro" }}
      start={
        <div className="isl-segs" role="group" aria-label="Visão do financeiro">
          {FINANCIAL_TABS.map((id) => (
            <button key={id} type="button" className="isl-seg" aria-pressed={id === tab} onClick={() => onTab(id)}>
              <i aria-hidden="true" />
              {FINANCIAL_TAB_LABEL[id]}
            </button>
          ))}
        </div>
      }
      end={
        <div className="isl-live" role="group" aria-label="Agora">
          <AdminIslandStat icon={<I n="lock" cls="sm" />} anim="bob" value={text("custody")} label="Em custódia" hint="Dinheiro dos clientes guardado pela plataforma agora" />
          <AdminIslandStat icon={<I n="arrup" cls="sm" />} anim="rise" tone="ok" value={text("funded_in_period")} label="Aportes no período" hint="Quanto os clientes colocaram na plataforma no período escolhido" />
        </div>
      }
      toolsRef={toolsRef}
      sheet={
        <div className="adm-fin-sheet">
          <div>
            <small>Comprometido</small>
            <b>{text("committed")}</b>
            <span>reservado para campanhas</span>
          </div>
          <div>
            <small>Saldo livre</small>
            <b>{text("free_balance")}</b>
            <span>dos clientes, sem destino</span>
          </div>
          <div>
            <small>Disponível para saque</small>
            <b>{text("available_to_withdraw")}</b>
            <span>dos criadores, já liberado</span>
          </div>
          <div>
            <small>Cobranças pendentes</small>
            <b>{text("pending_charges")}</b>
            <span>ainda não pagas</span>
          </div>
        </div>
      }
    />
  );
}
