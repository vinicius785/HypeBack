import { Link } from "@tanstack/react-router";

import { I } from "@/components/prototype/ui";
import { useCampaignConsumption } from "@/hooks/use-balance-movements";
import { getUploadUrl } from "@/lib/utils/api";
import type {
  CampaignConsumptionItem,
  CampaignStatus,
} from "@/shared/services/balance-movements";

import { fbrl, fbrl0 } from "./balance-overview";

import "@/styles/prototype-financial.css";

/**
 * Consumo de saldo por campanha (aba "Consumo por campanha").
 * Deve ser renderizado dentro de `.pv`. O filtro de status vive na página.
 */

const STATUS_FILTERS: { value: CampaignStatus; label: string }[] = [
  { value: "active", label: "Ativas" },
  { value: "finished", label: "Finalizadas" },
  { value: "all", label: "Todas" },
];

export function ConsumptionFilterChips({
  value,
  onChange,
}: {
  value: CampaignStatus;
  onChange: (v: CampaignStatus) => void;
}) {
  return (
    <div className="fchips fnx-fc">
      {STATUS_FILTERS.map((f) => (
        <button
          key={f.value}
          type="button"
          className={value === f.value ? "on" : ""}
          onClick={() => onChange(f.value)}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

export function CampaignConsumptionSection({
  status,
}: {
  status: CampaignStatus;
}) {
  const query = useCampaignConsumption({ status });
  const items = query.data?.items ?? [];
  const totals = query.data?.totals;

  if (query.isLoading)
    return (
      <div className="ov-empty big lvx-em">
        <small>Carregando consumo…</small>
      </div>
    );

  if (query.error)
    return (
      <div className="ov-empty big lvx-em">
        <span>
          <I n="x" />
        </span>
        <b>Erro ao carregar consumo</b>
        <small>{query.error.message}</small>
      </div>
    );

  if (items.length === 0)
    return (
      <div className="ov-empty big lvx-em">
        <span>
          <I n="mega" />
        </span>
        <b>Nenhuma campanha consumindo saldo</b>
        <small>Campanhas com reservas ativas vão aparecer aqui.</small>
      </div>
    );

  return (
    <>
      {totals && totals.campaign_count > 0 && (
        <p className="fnx-sum">
          <b>{totals.campaign_count}</b> campanha
          {totals.campaign_count === 1 ? "" : "s"} · <b>{fbrl(totals.committed_cents)}</b>{" "}
          reservado
        </p>
      )}
      <div className="fnx-gd">
        {items.map((it, k) => (
          <CampaignCard key={it.campaign_id} item={it} k={k} />
        ))}
      </div>
    </>
  );
}

function CampaignCard({ item, k }: { item: CampaignConsumptionItem; k: number }) {
  const banner = getUploadUrl(item.banner_url ?? undefined);
  const budget = item.max_budget_cents ?? 0;
  const base = budget > 0 ? budget : item.spent_cents + item.committed_cents;
  const pa = base > 0 ? Math.min(100, Math.round((item.spent_cents / base) * 100)) : 0;
  const pr =
    base > 0
      ? Math.min(100 - pa, Math.round((item.committed_cents / base) * 100))
      : 0;
  const inf = item.influencers;

  return (
    <div className="fnx-cc" style={{ ["--k" as string]: k }}>
      <Link
        to="/campaigns/$campaignId"
        params={{ campaignId: item.campaign_public_id }}
        className="fnx-ch"
      >
        <span className="lvx-im sm">
          {banner ? (
            <img
              src={banner}
              alt=""
              loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span style={{ display: "grid", placeItems: "center", height: "100%" }}>
              <I n="mega" />
            </span>
          )}
        </span>
        <div>
          <b>{item.title}</b>
          <small>
            {item.status === "finished" ? "Finalizada" : "Em execução"}
            {budget > 0 ? ` · orçamento ${fbrl0(budget)}` : ""} · {inf.active} ativo
            {inf.active === 1 ? "" : "s"} de {inf.total}
          </small>
        </div>
      </Link>
      <div className="fnx-pb">
        <i className="p" style={{ width: `${pa}%` }} />
        <i className="r" style={{ width: `${pr}%` }} />
      </div>
      <div className="fnx-cs">
        <div>
          <small>Pago</small>
          <b>{fbrl0(item.spent_cents)}</b>
        </div>
        <div>
          <small>Reservado</small>
          <b>{fbrl0(item.committed_cents)}</b>
        </div>
        {budget > 0 && (
          <div>
            <small>Livre</small>
            <b>{fbrl0(Math.max(0, budget - item.spent_cents - item.committed_cents))}</b>
          </div>
        )}
      </div>
    </div>
  );
}
