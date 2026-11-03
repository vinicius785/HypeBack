import type { ReactNode } from "react";

import {
  AdminBadge,
  AdminErrorState,
  AdminFigureCard,
  AdminFigureGrid,
  AdminLink,
  AdminSection,
} from "@/components/admin/platform";
import { useAdminFinancialSummary } from "@/hooks/admin/use-admin-financial";
import { formatDateRange, formatDateTime, isFigureAvailable } from "@/lib/admin/format";
import type { AdminDateRange, AdminFigure } from "@/shared/admin-platform.types";

import { FINANCIAL_GROUPS, FINANCIAL_RECONCILIATION_HELP } from "./financial-model";

import "@/styles/admin-financial.css";

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

/**
 * Visão geral: os números em blocos, o recado "liberado ≠ pago" e as conferências. Os indicadores não repetem o
 * tipo nem "no período" em cada número: o tipo e a regra estão no "i" de cada um, e o período vale o do cabeçalho.
 */
export function FinancialOverview({ period }: FinancialOverviewProps) {
  const query = useAdminFinancialSummary(period);
  const summary = query.data;

  if (query.error && !summary) {
    return <AdminErrorState boxed compact error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />;
  }

  const loading = query.isLoading;
  const figures = summary?.figures;
  const drift = summary?.reconciliation.committed_vs_reserved_drift;
  const unattributed = summary?.reconciliation.unattributed_reserved;
  const hasUnattributed = isFigureAvailable(unattributed) && unattributed.value > 0;

  return (
    <div className="adm-fin-stack">
      {query.error ? (
        <AdminErrorState boxed compact error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      ) : null}

      <p className="adm-fin-note">
        <span>
          <b>Liberado não é pago:</b> liberado é o que foi para o saldo do criador; pago é o PIX concluído.
        </span>
        {summary ? (
          <span className="adm-fin-note-meta">
            Período apurado: {formatDateRange(summary.period)} · gerado em {formatDateTime(summary.generated_at)}
          </span>
        ) : null}
      </p>

      {FINANCIAL_GROUPS.map((group) => (
        <AdminSection key={group.id} title={group.title} description={group.description} className={`adm-fin-group adm-fin-group-${group.id}`}>
          <AdminFigureGrid quiet>
            {group.figures.map((spec) => (
              <AdminFigureCard key={spec.key} variant="plain" label={spec.label} figure={figures?.[spec.key]} loading={loading} />
            ))}
          </AdminFigureGrid>
        </AdminSection>
      ))}

      <AdminSection
        title="Conferências"
        description="Cruzamentos entre fontes do banco que deveriam fechar; uma diferença é um sinal para investigar, não um erro desta tela."
        className="adm-fin-group adm-fin-group-conferencias"
      >
        <AdminFigureGrid quiet>
          <AdminFigureCard
            variant="plain"
            label="Comprometido × reservas"
            figure={drift}
            loading={loading}
            hint={driftBadge(drift)}
            hintInfo={FINANCIAL_RECONCILIATION_HELP.drift}
          />
          <AdminFigureCard
            variant="plain"
            label="Reservas sem campanha"
            figure={unattributed}
            loading={loading}
            hint={
              hasUnattributed ? (
                <AdminLink to={{ to: "/admin/financial", search: { tab: "by-workspace", from: period.from, to: period.to } }} textLink>
                  Ver por workspace
                </AdminLink>
              ) : undefined
            }
            hintInfo={FINANCIAL_RECONCILIATION_HELP.unattributed}
          />
        </AdminFigureGrid>
      </AdminSection>
    </div>
  );
}
