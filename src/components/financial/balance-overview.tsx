import { Av, I } from "@/components/prototype/ui";
import { useMovements } from "@/hooks/use-balance-movements";
import { useWorkspaceBalance } from "@/hooks/use-balance";
import type { BalanceMovement } from "@/shared/services/balance-movements";
import type { WorkspaceBalance } from "@/shared/services/balance";

import "@/styles/prototype-financial.css";

/**
 * Saldo do workspace.
 *
 * - variante `default`: hero do Financeiro (saldo disponível, reservado,
 *   ações rápidas e últimas movimentações) no visual do protótipo. Deve ser
 *   renderizado dentro de `.pv`.
 * - variante `compact`: resumo em Tailwind usado dentro do modal de depósito.
 */
export type FinancialTab = "mov" | "con" | "cpm";

interface BalanceOverviewProps {
  variant?: "default" | "compact";
  hidden?: boolean;
  onToggleHidden?: () => void;
  canDeposit?: boolean;
  onDeposit?: () => void;
  onTab?: (tab: FinancialTab) => void;
}

/** Centavos → "R$ 1.234,56" (com sinal opcional). */
export const fbrl = (cents: number, sign = false): string => {
  const s = (Math.abs(cents) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  return (sign ? (cents < 0 ? "− " : "+ ") : "") + s;
};

export const fbrl0 = (cents: number): string =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export const dayLabel = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(new Date()) - start(d)) / 86400000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  return `${d.getDate()} de ${MESES[d.getMonth()]}`;
};

export const timeLabel = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

export const movementIcon = (m: BalanceMovement): { icon: string; tone: string } => {
  switch (m.type) {
    case "reserve_created":
      return { icon: "lock", tone: "res" };
    case "reserve_cancelled":
    case "reserve_released":
      return { icon: "refresh", tone: "in" };
    case "payout":
      return { icon: "send", tone: "out" };
    case "adjustment_debit":
    case "top_up_refunded":
      return { icon: "arrup", tone: "out" };
    default:
      return { icon: "arrdown", tone: "in" };
  }
};

export function BalanceOverview({
  variant = "default",
  hidden = false,
  onToggleHidden,
  canDeposit = false,
  onDeposit,
  onTab,
}: BalanceOverviewProps) {
  const balanceQ = useWorkspaceBalance();

  if (balanceQ.isLoading) {
    return variant === "compact" ? (
      <CompactSkeleton />
    ) : (
      <div className="ov-empty big lvx-em" style={{ marginBottom: 20 }}>
        <small>Carregando saldo…</small>
      </div>
    );
  }

  if (balanceQ.error) {
    return variant === "compact" ? (
      <p className="text-sm text-danger-500">
        Erro ao carregar saldo: {balanceQ.error.message}
      </p>
    ) : (
      <div className="ov-empty big lvx-em" style={{ marginBottom: 20 }}>
        <span>
          <I n="x" />
        </span>
        <b>Erro ao carregar saldo</b>
        <small>{balanceQ.error.message}</small>
      </div>
    );
  }

  if (!balanceQ.data) return null;

  return variant === "compact" ? (
    <CompactView data={balanceQ.data} />
  ) : (
    <Hero
      data={balanceQ.data}
      hidden={hidden}
      onToggleHidden={onToggleHidden}
      canDeposit={canDeposit}
      onDeposit={onDeposit}
      onTab={onTab}
    />
  );
}

// ---------------------------------------------------------------------------
// Hero (protótipo: fnHero)
// ---------------------------------------------------------------------------

function Hero({
  data,
  hidden,
  onToggleHidden,
  canDeposit,
  onDeposit,
  onTab,
}: {
  data: WorkspaceBalance;
  hidden: boolean;
  onToggleHidden?: () => void;
  canDeposit: boolean;
  onDeposit?: () => void;
  onTab?: (tab: FinancialTab) => void;
}) {
  const M = (c: number) => (hidden ? "R$ ••••••" : fbrl(c));
  const pr =
    data.balance_cents > 0
      ? Math.round((data.committed_cents / data.balance_cents) * 100)
      : 0;
  const qa: { icon: string; label: string; onClick?: () => void; disabled?: boolean }[] = [
    { icon: "plus", label: "Depositar", onClick: onDeposit, disabled: !canDeposit },
    { icon: "chart", label: "Consumo", onClick: () => onTab?.("con") },
    { icon: "trend", label: "CPM", onClick: () => onTab?.("cpm") },
  ];

  return (
    <div className="fnx-hero fade">
      <div className="fnx-hm">
        <div className="fnx-ht">
          <span className="fnx-wi">
            <I n="wallet" cls="sm" />
          </span>
          <small>Saldo disponível</small>
        </div>
        <div className="fnx-big">
          <b>{M(data.available_cents)}</b>
          <button
            type="button"
            className={`fnx-ey ${hidden ? "off" : ""}`}
            aria-label="Ocultar valores"
            onClick={onToggleHidden}
          >
            <I n="eye" cls="sm" />
          </button>
        </div>
        <div className="fnx-pl">
          <span>
            <I n="lock" cls="sm" />
            Reservado {M(data.committed_cents)}
            <em>{hidden ? "" : `${pr}% do total`}</em>
          </span>
        </div>
        <div className="fnx-qh">
          <span>Ações rápidas</span>
        </div>
        <div className="fnx-qa" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          {qa.map((a) => (
            <button
              key={a.label}
              type="button"
              disabled={a.disabled}
              title={
                a.disabled
                  ? "Você não tem permissão para adicionar saldo"
                  : undefined
              }
              onClick={a.onClick}
            >
              <span>
                <I n={a.icon} />
              </span>
              {a.label}
            </button>
          ))}
        </div>
      </div>
      <RecentMovements hidden={hidden} onSeeAll={() => onTab?.("mov")} />
    </div>
  );
}

function RecentMovements({
  hidden,
  onSeeAll,
}: {
  hidden: boolean;
  onSeeAll: () => void;
}) {
  const query = useMovements({});
  const recent = (query.data?.pages.flatMap((p) => p.items) ?? []).slice(0, 4);

  return (
    <div className="fnx-hs">
      <div className="fnx-hh">
        <b>Últimas movimentações</b>
        <button type="button" onClick={onSeeAll}>
          Ver tudo
        </button>
      </div>
      <div className="fnx-rc">
        {recent.map((m) => {
          const r = m.related;
          const who = r.influencer_name || r.influencer_username || "";
          const { icon } = movementIcon(m);
          return (
            <div className="fnx-rr" key={m.id}>
              {who ? (
                <Av name={who} src={r.influencer_avatar ?? undefined} size={46} />
              ) : (
                <span className="fnx-ic in">
                  <I n={icon} cls="sm" />
                </span>
              )}
              <div>
                <b>{who || m.description || "Movimentação"}</b>
                <small>
                  {dayLabel(m.occurred_at)}, {timeLabel(m.occurred_at)}
                </small>
              </div>
              <b className={`fnx-v ${m.amount_cents > 0 ? "pos" : ""}`}>
                {hidden ? "••••" : fbrl(m.amount_cents, true)}
              </b>
            </div>
          );
        })}
        {recent.length === 0 && (
          <div className="fnx-none">
            {query.isLoading
              ? "Carregando…"
              : "Nenhuma movimentação por enquanto."}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compact (modal de depósito — Tailwind, fora de .pv)
// ---------------------------------------------------------------------------

function CompactView({ data }: { data: WorkspaceBalance }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-500">Total</span>
        <span className="text-sm font-medium text-neutral-950 tabular-nums">
          {fbrl(data.balance_cents)}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-500">Reservado</span>
        <span className="text-sm font-medium text-amber-700 tabular-nums">
          {fbrl(data.committed_cents)}
        </span>
      </div>
      <div className="h-px bg-neutral-200" />
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-700">Disponível</span>
        <span className="text-base font-bold text-success-600 tabular-nums">
          {fbrl(data.available_cents)}
        </span>
      </div>
    </div>
  );
}

function CompactSkeleton() {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-5 rounded-md bg-neutral-200 animate-pulse" />
      ))}
    </div>
  );
}
