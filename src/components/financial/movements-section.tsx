import { Link } from "@tanstack/react-router";

import { Av, I } from "@/components/prototype/ui";
import { useMovements } from "@/hooks/use-balance-movements";
import type {
  BalanceMovement,
  MovementType,
} from "@/shared/services/balance-movements";

import {
  dayLabel,
  fbrl,
  movementIcon,
  timeLabel,
} from "./balance-overview";

import "@/styles/prototype-financial.css";

/**
 * Histórico de movimentações de saldo (aba "Movimentações").
 *
 * Paginação cursor (useInfiniteQuery), agrupada por dia. Deve ser renderizado
 * dentro de `.pv`. O filtro de tipo vive na página (chips ao lado das abas) e
 * chega por props.
 */

// Apenas tipos com fonte de dados real no backend (asaas_charges +
// influencer_balance_entries). "Ajustes (+/−)" foram removidos: o endpoint
// /movements é virtual e não há feature de ajuste manual de saldo.
export type MovementFilter = MovementType | "all";

const TYPE_FILTERS: { value: MovementFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "top_up_confirmed", label: "Depósitos" },
  { value: "reserve_created", label: "Reservas" },
  { value: "reserve_cancelled", label: "Devoluções" },
  { value: "payout", label: "Pagamentos" },
];

const TYPE_LABEL: Record<MovementType, string> = {
  top_up_pending: "PIX pendente",
  top_up_confirmed: "Depósito",
  top_up_expired: "PIX expirado",
  top_up_refunded: "Estorno",
  reserve_created: "Reserva",
  reserve_released: "Liberação",
  reserve_cancelled: "Devolução",
  adjustment_credit: "Ajuste (+)",
  adjustment_debit: "Ajuste (−)",
  payout: "Pagamento",
};

export function MovementFilterChips({
  value,
  onChange,
}: {
  value: MovementFilter;
  onChange: (v: MovementFilter) => void;
}) {
  return (
    <div className="fchips fnx-fc">
      {TYPE_FILTERS.map((f) => (
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

export function MovementsSection({ type }: { type: MovementFilter }) {
  const query = useMovements(type === "all" ? {} : { type: [type] });
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  if (query.isLoading)
    return (
      <div className="ov-empty big lvx-em">
        <small>Carregando movimentações…</small>
      </div>
    );

  if (query.error)
    return (
      <div className="ov-empty big lvx-em">
        <span>
          <I n="x" />
        </span>
        <b>Erro ao carregar movimentações</b>
        <small>{query.error.message}</small>
      </div>
    );

  if (items.length === 0)
    return (
      <div className="ov-empty big lvx-em">
        <span>
          <I n="banknote" />
        </span>
        <b>Nenhuma movimentação</b>
        <small>Quando houver movimentos deste tipo, eles aparecem aqui.</small>
      </div>
    );

  const days: { label: string; it: BalanceMovement[] }[] = [];
  items.forEach((m) => {
    const label = dayLabel(m.occurred_at);
    const last = days[days.length - 1];
    if (last && last.label === label) last.it.push(m);
    else days.push({ label, it: [m] });
  });
  let k = 0;

  return (
    <>
      <div className="fnx-ls">
        {days.map((g) => (
          <div className="fnx-dy" key={g.label + g.it[0].id}>
            <h4>{g.label}</h4>
            {g.it.map((m) => (
              <MovementRow key={m.id} m={m} k={k++} />
            ))}
          </div>
        ))}
      </div>
      {query.hasNextPage && (
        <div className="fnx-more">
          <button
            type="button"
            className="btn out"
            disabled={query.isFetchingNextPage}
            onClick={() => query.fetchNextPage()}
          >
            {query.isFetchingNextPage ? "Carregando…" : "Carregar mais"}
          </button>
        </div>
      )}
    </>
  );
}

function MovementRow({ m, k }: { m: BalanceMovement; k: number }) {
  const r = m.related;
  const who = r.influencer_name || r.influencer_username?.replace(/^@/, "") || "";
  const { icon, tone } = movementIcon(m);
  const campaign =
    r.campaign_title?.trim() ||
    (r.campaign_id != null ? `Campanha #${r.campaign_id}` : "");
  const sub =
    [campaign, who].filter(Boolean).join(" · ") ||
    (m.actor.type === "user" && m.actor.name ? `por ${m.actor.name}` : "") ||
    "";
  const title = m.description || TYPE_LABEL[m.type];

  return (
    <div className="fnx-r" style={{ ["--k" as string]: k }}>
      {who ? (
        <Av name={who} src={r.influencer_avatar ?? undefined} size={52} />
      ) : (
        <span className={`fnx-ic ${tone}`}>
          <I n={icon} cls="sm" />
        </span>
      )}
      <div className="fnx-rn">
        <b>{title}</b>
        {sub &&
          (r.campaign_public_id ? (
            <small>
              <Link
                to="/campaigns/$campaignId"
                params={{ campaignId: r.campaign_public_id }}
                style={{ color: "inherit" }}
              >
                {sub}
              </Link>
            </small>
          ) : (
            <small>{sub}</small>
          ))}
      </div>
      <span className="fnx-tg">{TYPE_LABEL[m.type]}</span>
      <small className="fnx-tm">{timeLabel(m.occurred_at)}</small>
      <b className={`fnx-v ${m.amount_cents > 0 ? "pos" : ""}`}>
        {fbrl(m.amount_cents, true)}
      </b>
    </div>
  );
}
