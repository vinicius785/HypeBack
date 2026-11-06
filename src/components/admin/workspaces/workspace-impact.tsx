import type { ReactNode } from "react";

import { formatBRLFromCents, formatDateTime, formatInt } from "@/lib/admin/format";
import type { AdminDeleteBlocker, AdminWorkspaceImpact } from "@/shared/admin-platform.types";

import { BLOCKER_LABEL, LEDGER_STATUS_LABEL } from "./workspace-constants";

import "@/styles/admin-workspaces.css";

function Fact({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="adm-workspaces-fact">
      <dt>{label}</dt>
      <dd>
        {value}
        {hint ? <small>{hint}</small> : null}
      </dd>
    </div>
  );
}

const count = (n: number, one: string, many: string) => `${formatInt(n)} ${n === 1 ? one : many}`;

/**
 * O que existe hoje no workspace (contagens) e o dinheiro, exatos, como o servidor os calculou. São os números
 * que o `impact_token` assina: o servidor recalcula e recusa a ação se algum deles mudou.
 */
export function WorkspaceImpactSummary({ impact }: { impact: AdminWorkspaceImpact }) {
  const { counts: c, money: m } = impact;
  const ledger = Object.entries(c.ledger_entries)
    .filter(([, n]) => n > 0)
    .map(([status, n]) => `${formatInt(n)} ${LEDGER_STATUS_LABEL[status] ?? status}`)
    .join(" · ");

  return (
    <div className="adm-workspaces-impact">
      <h3>O que existe hoje</h3>
      <dl className="adm-workspaces-facts">
        <Fact label="Membros" value={formatInt(c.members)} />
        <Fact
          label="Campanhas"
          value={formatInt(c.campaigns_total)}
          hint={`${count(c.campaigns_published, "publicada", "publicadas")} · ${count(c.campaigns_draft, "rascunho", "rascunhos")} · ${count(c.campaigns_finished, "finalizada", "finalizadas")}`}
        />
        <Fact label="Criadores" value={formatInt(c.creators)} hint={count(c.participations, "participação", "participações")} />
        <Fact label="Contratos" value={formatInt(c.contracts)} />
      </dl>

      <h3>Dinheiro</h3>
      <dl className="adm-workspaces-facts">
        <Fact label="Em custódia" value={formatBRLFromCents(m.custody_cents)} />
        <Fact label="Comprometido" value={formatBRLFromCents(m.committed_cents)} />
        <Fact
          label="Aportado no total"
          value={formatBRLFromCents(m.funded_total_cents)}
          hint={count(c.charges_total, "cobrança", "cobranças")}
        />
        <Fact
          label="Cobranças pendentes"
          value={formatBRLFromCents(m.pending_charges_cents)}
          hint={count(c.charges_pending, "cobrança", "cobranças")}
        />
        <Fact label="Reservas em aberto" value={formatBRLFromCents(m.reserved_entries_cents)} />
        <Fact label="Liberado e não sacado" value={formatBRLFromCents(m.released_not_withdrawn_cents)} />
        <Fact
          label="Saques em andamento"
          value={formatBRLFromCents(m.withdrawals_in_flight_cents)}
          hint={count(c.withdrawals_in_flight, "saque", "saques")}
        />
      </dl>
      {ledger ? <p className="adm-workspaces-quiet">Lançamentos dos criadores: {ledger}.</p> : null}
      <p className="adm-workspaces-quiet">Resumo calculado em {formatDateTime(impact.computed_at)}.</p>
    </div>
  );
}

/** Avisos que não impedem a ação, mas a pessoa precisa saber. */
export function WorkspaceImpactWarnings({ warnings }: { warnings: AdminWorkspaceImpact["warnings"] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="adm-conseq">
      <b>Atenção</b>
      <ul>
        {warnings.map((warning) => (
          <li key={warning.code}>{warning.message}</li>
        ))}
      </ul>
    </div>
  );
}

/** Lista de "o que acontece" da ação (texto do servidor, em linguagem de produto). */
export function WorkspaceConsequences({ items }: { items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="adm-conseq">
      <b>O que acontece</b>
      <ul>
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/** O que cada impedimento mede, ao lado do texto do servidor: a quantidade e o valor exatos. */
function blockerFacts(blocker: AdminDeleteBlocker): string | null {
  const parts = [
    blocker.count !== undefined ? formatInt(blocker.count) : null,
    blocker.amount_cents !== undefined ? formatBRLFromCents(blocker.amount_cents) : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Impedimentos da exclusão: cada um com o texto do servidor e os números. O Admin não passa por cima
 * deles; a saída é resolver (ou arquivar o workspace, que não tem essas travas).
 */
export function WorkspaceBlockers({
  blockers,
  onArchive,
  resolveHint,
}: {
  blockers: readonly AdminDeleteBlocker[];
  /** Troca a frase final (padrão: a do workspace). */
  resolveHint?: string;
  /** Presente quando o estado atual permite arquivar: vira o botão "Arquivar em vez de excluir". */
  onArchive?: () => void;
}) {
  return (
    <div className="adm-workspaces-blockers" role="group" aria-label="Impedimentos da exclusão">
      <b>A exclusão está bloqueada</b>
      <ul>
        {blockers.map((blocker) => {
          const facts = blockerFacts(blocker);
          return (
            <li key={blocker.code}>
              <span className="adm-workspaces-blocker-title">
                {BLOCKER_LABEL[blocker.code] ?? "Impedimento"}
                {facts ? <em>{facts}</em> : null}
              </span>
              <span>{blocker.message}</span>
            </li>
          );
        })}
      </ul>
      <p>
        {resolveHint ??
          `Resolva os impedimentos acima para poder excluir${onArchive ? ", ou arquive o workspace em vez de excluir" : ""}.`}
      </p>
      {onArchive ? (
        <button type="button" className="btn out adm-btn-sm" onClick={onArchive}>
          Arquivar em vez de excluir
        </button>
      ) : null}
    </div>
  );
}
