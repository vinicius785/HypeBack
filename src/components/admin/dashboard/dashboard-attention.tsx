import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

import {
  AdminEmptyState,
  AdminErrorState,
  AdminLink,
  AdminListSkeleton,
  AdminSection,
  AdminStatusBadge,
  adminLinkFromContract,
} from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import type { DashboardAlerts } from "@/hooks/admin/use-admin-overview";
import { formatDateTime, formatInt } from "@/lib/admin/format";
import { ALERT_KIND_LABEL } from "@/lib/admin/labels";
import type { AdminAlert } from "@/shared/admin-platform.types";

import { pickAttentionAlerts } from "./dashboard-model";

import "@/styles/admin-dashboard.css";

/** O que cada tipo quer dizer: é o que separa um fato registrado de uma heurística, e fica no detalhe recolhido. */
const KIND_MEANING: Record<string, string> = {
  alert: "fato registrado no banco",
  suggestion: "heurística com limite escolhido pelo produto",
};

function kindText(kind: string): string {
  const label = ALERT_KIND_LABEL[kind as keyof typeof ALERT_KIND_LABEL] ?? kind;
  const meaning = KIND_MEANING[kind];
  return meaning ? `${label} (${meaning})` : label;
}

/**
 * Um alerta ou sugestão em formato compacto: gravidade, título, quantas ocorrências e, havendo destino (`link` do
 * contrato), a seta; a linha inteira leva à tela filtrada. A descrição, o tipo (alerta = fato registrado; sugestão =
 * heurística) e a REGRA exata ficam num detalhe recolhido, "Como é calculado": continuam à mão sem pesar na lista.
 */
function AttentionRow({ alert }: { alert: AdminAlert }) {
  const target = alert.link ? adminLinkFromContract(alert.link) : undefined;
  return (
    <li className="adm-dash-alert" data-link={target ? "true" : undefined}>
      <div className="adm-dash-alert-line">
        <AdminStatusBadge kind="severity" value={alert.severity} size="sm" />
        <h3 className="adm-dash-alert-title">
          {target ? (
            <AdminLink to={target} className="adm-dash-alert-link">
              {alert.title}
            </AdminLink>
          ) : (
            alert.title
          )}
        </h3>
        <div className="adm-dash-alert-side">
          <span className="adm-dash-alert-count">
            <b>{formatInt(alert.count)}</b>
            <small>{alert.count === 1 ? "ocorrência" : "ocorrências"}</small>
          </span>
          {target ? (
            <span className="adm-dash-alert-go" aria-hidden="true">
              <I n="chev" cls="sm" />
            </span>
          ) : null}
        </div>
      </div>
      <details className="adm-dash-alert-more">
        <summary className="adm-summary">Como é calculado</summary>
        <p className="adm-dash-alert-desc">{alert.description}</p>
        <dl className="adm-alert-rule">
          <dt>Tipo</dt>
          <dd>{kindText(alert.kind)}</dd>
          <dt>Regra</dt>
          <dd>{alert.rule}</dd>
        </dl>
      </details>
    </li>
  );
}

/**
 * "Precisa de atenção · N": os alertas de `GET /admin/health/alerts`, os de verdade (fatos) antes das sugestões
 * (heurísticas), do mais grave ao menos grave, no máximo 6, com "Ver todos" para a Saúde da plataforma; o N do título é
 * o total que o servidor mandou (o que não coube está em "Ver todos"). Sem nenhum, é uma tela de "tudo em ordem"; com
 * falha, o estado de erro com "Tentar de novo".
 */
export function DashboardAttention({ query }: { query: UseQueryResult<DashboardAlerts, unknown> }) {
  const { data, isError, error, refetch, isFetching } = query;

  let body: ReactNode;
  if (!data) {
    body = isError ? (
      <AdminErrorState compact error={error} onRetry={() => void refetch()} retrying={isFetching} />
    ) : (
      <AdminListSkeleton variant="alerts" rows={3} ariaLabel="Carregando alertas…" />
    );
  } else if (data.alerts.length === 0) {
    body = (
      <AdminEmptyState
        compact
        icon="check"
        title="Tudo em ordem"
        description={
          data.computedAt
            ? `Nenhum alerta nem sugestão no momento. Calculado em ${formatDateTime(data.computedAt)}.`
            : "Nenhum alerta nem sugestão no momento."
        }
      />
    );
  } else {
    body = (
      <ul className="adm-dash-alerts">
        {pickAttentionAlerts(data.alerts).map((alert) => (
          <AttentionRow key={alert.id} alert={alert} />
        ))}
      </ul>
    );
  }

  return (
    <AdminSection
      title={data && data.alerts.length > 0 ? `Precisa de atenção · ${formatInt(data.alerts.length)}` : "Precisa de atenção"}
      actions={
        <AdminLink to="/admin/health" className="btn out adm-btn-sm">
          Ver todos
          <I n="chev" cls="sm" />
        </AdminLink>
      }
    >
      {body}
    </AdminSection>
  );
}
