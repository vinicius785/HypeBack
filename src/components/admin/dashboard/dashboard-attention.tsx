import type { CSSProperties, ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

import {
  AdminErrorState,
  AdminLink,
  adminLinkFromContract,
} from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
import { CountUp } from "@/components/home/count-up";
import type { DashboardAlerts } from "@/hooks/admin/use-admin-overview";
import { formatDateTime, formatInt } from "@/lib/admin/format";
import { ALERT_KIND_LABEL } from "@/lib/admin/labels";
import type { AdminAlert } from "@/shared/admin-platform.types";

import { pickAttentionAlerts } from "./dashboard-model";

import "@/styles/home-my-work.css";
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
/** Ícone de cada gravidade: o que alerta (crítico e atenção) leva o sinal de alerta; o informativo, o olho. */
const SEVERITY_ICON: Record<string, string> = { critical: "alert", warning: "alert", info: "eye" };
const SEVERITY_LABEL: Record<string, string> = { critical: "Crítico", warning: "Atenção", info: "Informativo" };

/**
 * Uma linha do cartão (a mesma do "Meu trabalho" da Início): o ícone na cor da gravidade, o título (a linha inteira leva à tela
 * filtrada quando há destino), a gravidade em texto pequeno, o número grande de ocorrências e a seta. A descrição, o tipo
 * (alerta = fato registrado; sugestão = heurística) e a REGRA exata ficam num "Como é calculado" recolhido logo abaixo.
 */
function AttentionRow({ alert, index }: { alert: AdminAlert; index: number }) {
  const target = alert.link ? adminLinkFromContract(alert.link) : undefined;
  const inner = (
    <>
      <span className="mw-ic adm-att-ic" data-severity={alert.severity} aria-hidden="true">
        <I n={SEVERITY_ICON[alert.severity] ?? "alert"} />
      </span>
      <span className="mw-tx">
        <b>{alert.title}</b>
        <small>
          <span className="adm-att-sev" data-severity={alert.severity}>
            {SEVERITY_LABEL[alert.severity] ?? alert.severity}
          </span>
        </small>
      </span>
      <span className="mw-c">
        {formatInt(alert.count)}
        <small className="adm-att-unit">{alert.count === 1 ? "ocorrência" : "ocorrências"}</small>
      </span>
      {target ? <I n="chev" cls="sm mw-ch" /> : null}
    </>
  );
  return (
    <li style={{ "--i": Math.min(index, 8) } as CSSProperties} data-severity={alert.severity} data-link={target ? "true" : undefined}>
      {target ? (
        <AdminLink to={target} className="mw-r">
          {inner}
        </AdminLink>
      ) : (
        <div className="mw-r">{inner}</div>
      )}
      <details className="adm-att-more">
        <summary>Como é calculado</summary>
        <p>{alert.description}</p>
        <dl>
          <dt>Tipo</dt>
          <dd>{kindText(alert.kind)}</dd>
          <dt>Regra</dt>
          <dd>{alert.rule}</dd>
        </dl>
      </details>
    </li>
  );
}

/** "1 de atenção · 2 informativos": o resumo da linha de apoio do cartão. */
function severitySummary(alerts: readonly AdminAlert[]): string {
  const parts = [
    { id: "critical", one: "crítico", many: "críticos" },
    { id: "warning", one: "de atenção", many: "de atenção" },
    { id: "info", one: "informativo", many: "informativos" },
  ]
    .map((o) => ({ ...o, n: alerts.filter((a) => a.severity === o.id).length }))
    .filter((o) => o.n > 0)
    .map((o) => `${formatInt(o.n)} ${o.n === 1 ? o.one : o.many}`);
  return parts.length > 0 ? parts.join(" · ") : "Nada pendente";
}

/**
 * "Precisa de atenção": os alertas de `GET /admin/health/alerts`, os de verdade (fatos) antes das sugestões (heurísticas), do
 * mais grave ao menos grave, no máximo 6. Mesmo desenho do "Meu trabalho" da Início (cartão preto com luz roxa, número grande,
 * lista agrupada e rodapé): o número grande é o total que o servidor mandou, e "Ver todos" no rodapé leva à tela de
 * Monitoramento, onde está o que não coube. Sem nenhum, "Tudo em ordem"; com falha, o estado de erro com "Tentar de novo".
 */
export function DashboardAttention({ query }: { query: UseQueryResult<DashboardAlerts, unknown> }) {
  const { data, isError, error, refetch, isFetching } = query;
  const total = data?.alerts.length;

  let body: ReactNode;
  if (!data) {
    body = isError ? (
      <div className="adm-att-light">
        <AdminErrorState compact error={error} onRetry={() => void refetch()} retrying={isFetching} />
      </div>
    ) : (
      <>
        <span className="adm-sr" role="status">
          Carregando alertas…
        </span>
        <ul className="mw-l" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <div className="mw-sk" />
            </li>
          ))}
        </ul>
      </>
    );
  } else if (data.alerts.length === 0) {
    body = (
      <div className="mw-empty">
        <span>
          <I n="check" />
        </span>
        <b>Tudo em ordem</b>
        <p>
          {data.computedAt
            ? `Nenhum alerta nem sugestão no momento. Calculado em ${formatDateTime(data.computedAt)}.`
            : "Nenhum alerta nem sugestão no momento."}
        </p>
      </div>
    );
  } else {
    body = (
      <ul className="mw-l adm-att-list">
        {pickAttentionAlerts(data.alerts).map((alert, index) => (
          <AttentionRow key={alert.id} alert={alert} index={index} />
        ))}
      </ul>
    );
  }

  return (
    <section className="tkcard mw adm-att" aria-labelledby="adm-att-h">
      <div className="mw-h">
        <div>
          <h2 id="adm-att-h">Precisa de atenção</h2>
          <p className="sub">{data ? severitySummary(data.alerts) : "Alertas e sugestões da plataforma"}</p>
        </div>
      </div>

      <div className="mw-n">
        <b>{total === undefined ? "—" : <CountUp value={total} duration={700} />}</b>
        <span>{total === 1 ? "item pedindo atenção" : "itens pedindo atenção"}</span>
      </div>

      {body}

      <div className="mw-f">
        <AdminLink to="/admin/activity" className="adm-att-all">
          Ver todos
          <I n="chev" cls="sm" />
        </AdminLink>
      </div>
    </section>
  );
}
