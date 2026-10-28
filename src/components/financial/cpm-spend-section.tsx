import { Link } from "@tanstack/react-router";

import { I } from "@/components/prototype/ui";
import { useCpmSpend } from "@/hooks/use-balance-movements";
import type { CpmCampaignSpend } from "@/shared/services/balance-movements";

import { fbrl, fbrl0 } from "./balance-overview";

import "@/styles/prototype-financial.css";

/**
 * Gasto atualizado das campanhas CPM (aba "Campanhas CPM").
 * Deve ser renderizado dentro de `.pv`.
 */

const formatInt = (n: number): string =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

const formatRelativeWindow = (iso: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const days = Math.round((d.getTime() - Date.now()) / 86400000);
  if (days < 0) return "encerrada";
  if (days === 0) return "hoje";
  if (days === 1) return "em 1 dia";
  return `em ${days} dias`;
};

export function CpmSpendSection() {
  const query = useCpmSpend();
  const items = query.data?.items ?? [];

  if (query.isLoading)
    return (
      <div className="ov-empty big lvx-em">
        <small>Carregando campanhas CPM…</small>
      </div>
    );

  if (query.error)
    return (
      <div className="ov-empty big lvx-em">
        <span>
          <I n="x" />
        </span>
        <b>Erro ao carregar gastos CPM</b>
        <small>{query.error.message}</small>
      </div>
    );

  if (items.length === 0)
    return (
      <div className="ov-empty big lvx-em">
        <span>
          <I n="chart" />
        </span>
        <b>Nenhuma campanha CPM com publicações ativas</b>
        <small>
          Campanhas no modelo CPM com publicações dentro da janela de 7 dias
          vão aparecer aqui.
        </small>
      </div>
    );

  return (
    <div className="fnx-lcp">
      {items.map((it, k) => (
        <CpmCard key={it.campaign_id} item={it} k={k} />
      ))}
    </div>
  );
}

function CpmCard({ item, k }: { item: CpmCampaignSpend; k: number }) {
  const { totals, tracking_window: tw } = item;
  return (
    <div className="fnx-cp" style={{ ["--k" as string]: k }}>
      <Link
        to="/campaigns/$campaignId"
        params={{ campaignId: item.campaign_public_id }}
        className="fnx-ch"
      >
        <span className="lvx-im sm">
          <span style={{ display: "grid", placeItems: "center", height: "100%" }}>
            <I n="mega" />
          </span>
        </span>
        <div>
          <b>{item.title}</b>
          <small>
            CPM de {fbrl(item.cpm_rate_cents)} · janela de 7 dias após a
            publicação · {tw.active_publications} ativa
            {tw.active_publications === 1 ? "" : "s"}
            {tw.expired_publications > 0
              ? ` · ${tw.expired_publications} encerrada${tw.expired_publications === 1 ? "" : "s"}`
              : ""}
            {tw.earliest_window_end
              ? ` · próx. fim ${formatRelativeWindow(tw.earliest_window_end)}`
              : ""}
          </small>
        </div>
      </Link>
      <div className="fnx-cs four">
        <div>
          <small>Views contabilizadas</small>
          <b>{formatInt(totals.views_billable)}</b>
        </div>
        <div>
          <small>Gasto acumulado</small>
          <b>{fbrl0(totals.spent_cents)}</b>
        </div>
        <div>
          <small>Reservado</small>
          <b>{fbrl0(totals.committed_cents)}</b>
        </div>
        <div>
          <small>Orçamento restante</small>
          <b className="ok">{fbrl0(totals.remaining_budget_cents)}</b>
        </div>
      </div>
    </div>
  );
}
