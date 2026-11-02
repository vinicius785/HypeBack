import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

import {
  AdminEmptyState,
  AdminErrorState,
  AdminLink,
  AdminSection,
  AdminSkeleton,
  AdminSkeletonLines,
  AdminStatusBadge,
  adminLinkFromContract,
} from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import type { DashboardAlerts } from "@/hooks/admin/use-admin-overview";
import { formatDateTime, formatInt } from "@/lib/admin/format";
import type { AdminAlert } from "@/shared/admin-platform.types";

import { pickAttentionAlerts } from "./dashboard-model";

import "@/styles/admin-dashboard.css";

/**
 * Um alerta ou sugestão em formato compacto: tipo (alerta = fato registrado; sugestão = heurística), gravidade, título,
 * a descrição e a REGRA exata sempre à vista, e quantas ocorrências. Com destino (`link` do contrato), a linha inteira
 * leva à tela filtrada.
 */
function AttentionRow({ alert }: { alert: AdminAlert }) {
  const target = alert.link ? adminLinkFromContract(alert.link) : undefined;
  return (
    <li className="adm-dash-alert" data-link={target ? "true" : undefined}>
      <div className="adm-dash-alert-main">
        <div className="adm-dash-alert-tags">
          <AdminStatusBadge kind="alert-kind" value={alert.kind} size="sm" />
          <AdminStatusBadge kind="severity" value={alert.severity} size="sm" />
        </div>
        <h3 className="adm-dash-alert-title">
          {target ? (
            <AdminLink to={target} className="adm-dash-alert-link">
              {alert.title}
            </AdminLink>
          ) : (
            alert.title
          )}
        </h3>
        <p className="adm-dash-alert-desc">{alert.description}</p>
        <p className="adm-dash-alert-rule">
          <span className="adm-dash-alert-rule-k">Regra</span> {alert.rule}
        </p>
      </div>
      <div className="adm-dash-alert-side">
        <div className="adm-dash-alert-count">
          <b>{formatInt(alert.count)}</b>
          <small>{alert.count === 1 ? "ocorrência" : "ocorrências"}</small>
        </div>
        {target ? (
          <span className="adm-dash-alert-go" aria-hidden="true">
            <I n="chev" cls="sm" />
          </span>
        ) : null}
      </div>
    </li>
  );
}

function AttentionSkeleton() {
  return (
    <div aria-busy="true">
      <span className="adm-sr" role="status">
        Carregando alertas…
      </span>
      {[0, 1, 2].map((row) => (
        <div className="adm-dash-sk-row" key={row}>
          <span className="adm-dash-sk-tags">
            <AdminSkeleton width={64} height={22} radius={999} />
            <AdminSkeleton width={78} height={22} radius={999} />
          </span>
          <AdminSkeleton width="58%" height={16} />
          <AdminSkeletonLines lines={2} lastWidth="72%" />
        </div>
      ))}
    </div>
  );
}

/**
 * "Precisa de atenção": os alertas de `GET /admin/health/alerts`, os de verdade (fatos) antes das sugestões
 * (heurísticas), do mais grave ao menos grave, no máximo 6, com "Ver todos" para a Saúde da plataforma. Sem nenhum,
 * é uma tela de "tudo em ordem"; com falha, o estado de erro com "Tentar de novo".
 */
export function DashboardAttention({ query }: { query: UseQueryResult<DashboardAlerts, unknown> }) {
  const { data, isError, error, refetch, isFetching } = query;

  let body: ReactNode;
  if (!data) {
    body = isError ? (
      <AdminErrorState compact error={error} onRetry={() => void refetch()} retrying={isFetching} />
    ) : (
      <AttentionSkeleton />
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
    const shown = pickAttentionAlerts(data.alerts);
    body = (
      <>
        <ul className="adm-dash-alerts">
          {shown.map((alert) => (
            <AttentionRow key={alert.id} alert={alert} />
          ))}
        </ul>
        {data.alerts.length > shown.length ? (
          <p className="adm-dash-foot">
            Mostrando {shown.length} de {data.alerts.length}. Os demais estão em “Ver todos”.
          </p>
        ) : null}
      </>
    );
  }

  return (
    <AdminSection
      title="Precisa de atenção"
      description="Alerta é um fato registrado; sugestão é uma heurística com limite escolhido pelo produto."
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
