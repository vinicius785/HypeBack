import { Fragment, type ReactNode } from "react";

import {
  AdminBadge,
  AdminErrorState,
  AdminFigureCard,
  AdminLink,
  AdminSection,
} from "@/components/admin/platform";
import { useAdminFinancialSummary } from "@/hooks/admin/use-admin-financial";
import { formatDateRange, formatDateTime, isFigureAvailable } from "@/lib/admin/format";
import type { AdminDateRange, AdminFigure, AdminFinancialFigures } from "@/shared/admin-platform.types";

import "@/styles/admin-financial.css";

interface FigureSpec {
  key: keyof AdminFinancialFigures;
  label: string;
  /** Vale só para os dias escolhidos (os demais são a posição de agora ou o histórico inteiro). */
  inPeriod?: boolean;
}

interface GroupSpec {
  id: string;
  title: string;
  description: string;
  figures: readonly FigureSpec[];
}

/**
 * Os números do contrato (`AdminFinancialFigures`) em blocos com nome. O texto de cada número, o tipo
 * (realizado, comprometido, posição atual, calculado, não apurado) e a regra de cálculo vêm da API: a tela só
 * escolhe o rótulo e a ordem.
 */
export const FINANCIAL_GROUPS: readonly GroupSpec[] = [
  {
    id: "entradas",
    title: "Entradas",
    description: "Dinheiro que os clientes colocaram na plataforma, por PIX.",
    figures: [
      { key: "funded_in_period", label: "Aportes no período", inPeriod: true },
      { key: "funded_total", label: "Aportes totais" },
      { key: "pending_charges", label: "Cobranças pendentes" },
    ],
  },
  {
    id: "custodia",
    title: "Custódia",
    description: "Saldo que a plataforma guarda agora nos workspaces. O comprometido já está dentro da custódia: não se soma a ela.",
    figures: [
      { key: "custody", label: "Em custódia" },
      { key: "committed", label: "Comprometido" },
      { key: "free_balance", label: "Saldo livre" },
    ],
  },
  {
    id: "criadores",
    title: "Criadores",
    description: "O que já foi liberado aos criadores e em que etapa está. Liberado é diferente de pago.",
    figures: [
      { key: "in_grace", label: "Em carência" },
      { key: "available_to_withdraw", label: "Disponível para saque" },
      { key: "withdrawals_in_flight", label: "Saques em andamento" },
      { key: "released_in_period", label: "Liberado no período", inPeriod: true },
      { key: "released_total", label: "Liberado no total" },
    ],
  },
  {
    id: "pago",
    title: "Pago",
    description: "Pago é o PIX concluído para o criador.",
    figures: [
      { key: "paid_pix_in_period", label: "Pago via PIX no período", inPeriod: true },
      { key: "paid_pix_total", label: "Pago via PIX no total" },
    ],
  },
  {
    id: "plataforma",
    title: "Plataforma",
    description: "Taxas e comissão que ficam com a plataforma.",
    figures: [{ key: "platform_revenue", label: "Receita da plataforma" }],
  },
];

/** `0` é "as duas fontes batem"; qualquer outro valor é um sinal para investigar. Sem número, sem veredito. */
function driftBadge(figure: AdminFigure | undefined): ReactNode {
  if (!isFigureAvailable(figure)) return null;
  return figure.value === 0 ? (
    <AdminBadge tone="ok" size="sm">
      Confere
    </AdminBadge>
  ) : (
    <AdminBadge tone="warn" size="sm">
      Investigar
    </AdminBadge>
  );
}

interface FinancialOverviewProps {
  period: AdminDateRange;
}

/** Visão geral: os números do período em blocos, o recado "liberado ≠ pago" e as conferências. */
export function FinancialOverview({ period }: FinancialOverviewProps) {
  const query = useAdminFinancialSummary(period);
  const summary = query.data;

  if (query.error && !summary) {
    return <AdminErrorState boxed error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />;
  }

  const loading = query.isLoading;
  const figures = summary?.figures;
  const unattributed = summary?.reconciliation.unattributed_reserved;

  return (
    <div className="adm-fin-stack">
      {query.error ? (
        <div className="adm-fin-alert">
          <AdminErrorState compact error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
        </div>
      ) : null}

      <p className="adm-fin-note">
        <b>Liberado não é pago.</b> Liberado é o valor que foi para o saldo do criador (em carência, disponível ou já sacado); pago é o PIX
        concluído. Os dois aparecem separados nesta página. Os números “no período” seguem os dias escolhidos; os de “Posição atual” são a
        foto de agora e não mudam com o período.
        {summary ? (
          <span className="adm-fin-note-meta">
            Período apurado: {formatDateRange(summary.period)} · gerado em {formatDateTime(summary.generated_at)}
          </span>
        ) : null}
      </p>

      {FINANCIAL_GROUPS.map((group) => (
        <AdminSection key={group.id} title={group.title} description={group.description} className={`adm-fin-group adm-fin-group-${group.id}`}>
          <div className="adm-fin-figs">
            {group.figures.map((spec) => (
              <AdminFigureCard
                key={spec.key}
                variant="plain"
                label={spec.label}
                figure={figures?.[spec.key]}
                loading={loading}
                hint={spec.inPeriod ? "no período" : undefined}
              />
            ))}
          </div>
        </AdminSection>
      ))}

      <AdminSection
        title="Conferências"
        description="Cruzamentos entre fontes do banco que deveriam fechar. Uma diferença diferente de zero é um sinal para investigar, não um erro desta tela."
        className="adm-fin-group adm-fin-group-conferencias"
      >
        <div className="adm-fin-figs">
          <AdminFigureCard
            variant="plain"
            label="Comprometido × reservas"
            figure={summary?.reconciliation.committed_vs_reserved_drift}
            loading={loading}
            hint={driftBadge(summary?.reconciliation.committed_vs_reserved_drift)}
          />
          <AdminFigureCard variant="plain" label="Reservas sem campanha" figure={unattributed} loading={loading} />
        </div>
        <div className="adm-fin-recon">
          <p>
            <b>Comprometido × reservas</b> é o comprometido guardado nos saldos dos workspaces menos as reservas do ledger ligadas a campanhas.
            Zero quer dizer que as duas fontes batem; qualquer outro valor pede investigação antes de confiar na custódia e no saldo livre.
          </p>
          <p>
            <b>Reservas sem campanha</b> não pertencem a nenhum workspace.
            {isFigureAvailable(unattributed) && unattributed.value > 0 ? (
              <Fragment>
                {" "}
                Elas aparecem como “Não atribuído” na distribuição{" "}
                <AdminLink
                  to={{ to: "/admin/financial", search: { tab: "by-workspace", from: period.from, to: period.to } }}
                  className="adm-fin-link"
                >
                  por workspace
                </AdminLink>
                .
              </Fragment>
            ) : null}
          </p>
        </div>
      </AdminSection>
    </div>
  );
}
