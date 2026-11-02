import { AdminLink, AdminSkeleton, AdminStatusBadge, adminLinkFromContract } from "@/components/admin/platform";
import { formatInt } from "@/lib/admin/format";
import { ALERT_SEVERITY_LABEL } from "@/lib/admin/labels";
import type { AdminAlert, AdminAlertSeverity } from "@/shared/admin-platform.types";

import { sampleLink } from "./health-links";
import { ALERT_SEVERITIES } from "./health-search";

import "@/styles/admin-health.css";

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/** Até 5 exemplos do contrato: só nome/identificador público, nunca dado pessoal. Os que têm tela viram link. */
function Samples({ alert }: { alert: AdminAlert }) {
  if (alert.samples.length === 0) return null;
  const partial = alert.samples.length < alert.count;
  return (
    <div className="adm-health-samples">
      <span>{partial ? `Exemplos (${alert.samples.length} de ${formatInt(alert.count)}):` : "Exemplos:"}</span>
      {alert.samples.map((sample) => {
        const target = sampleLink(sample);
        const content = (
          <>
            {sample.label}
            {sample.detail ? <small>{sample.detail}</small> : null}
          </>
        );
        return target ? (
          <AdminLink key={`${sample.type}:${sample.id}`} to={target} className="adm-health-sample">
            {content}
          </AdminLink>
        ) : (
          <span key={`${sample.type}:${sample.id}`} className="adm-health-sample">
            {content}
          </span>
        );
      })}
    </div>
  );
}

/** Alerta: fato objetivo guardado no banco. Mostra a regra exata e a origem dos dados, sempre visíveis. */
function HealthAlertCard({ alert }: { alert: AdminAlert }) {
  return (
    <article className="adm-health-alert" data-severity={alert.severity} aria-label={alert.title}>
      <div className="adm-health-main">
        <div className="adm-health-tags">
          <AdminStatusBadge kind="severity" value={alert.severity} size="sm" />
          <AdminStatusBadge kind="alert-kind" value={alert.kind} size="sm" />
        </div>
        <h4>{alert.title}</h4>
        <p className="adm-health-desc">{alert.description}</p>
        <dl className="adm-health-rule">
          <dt>Regra</dt>
          <dd>{alert.rule}</dd>
          <dt>Origem</dt>
          <dd>{alert.source}</dd>
        </dl>
      </div>
      <div className="adm-health-count">
        <b>{formatInt(alert.count)}</b>
        <small>{plural(alert.count, "ocorrência", "ocorrências")}</small>
      </div>
      <Samples alert={alert} />
      {alert.link ? (
        <div className="adm-health-foot">
          <AdminLink to={adminLinkFromContract(alert.link)} className="btn out adm-btn-sm">
            Ver todos
          </AdminLink>
        </div>
      ) : null}
    </article>
  );
}

/** Alertas agrupados por gravidade (crítico, atenção, informativo); grupo sem alerta não aparece. */
export function HealthAlertGroups({ alerts }: { alerts: readonly AdminAlert[] }) {
  const groups: Array<{ severity: AdminAlertSeverity; items: AdminAlert[] }> = ALERT_SEVERITIES.map((severity) => ({
    severity,
    items: alerts.filter((alert) => alert.severity === severity),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="adm-health-groups">
      {groups.map((group) => (
        <section className="adm-health-group" key={group.severity} aria-label={`Alertas: ${ALERT_SEVERITY_LABEL[group.severity]}`}>
          <h3>
            {ALERT_SEVERITY_LABEL[group.severity]}
            <em>{formatInt(group.items.length)}</em>
          </h3>
          <div className="adm-health-list">
            {group.items.map((alert) => (
              <HealthAlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * Sugestão: heurística com limite escolhido pelo produto, não um fato confirmado. Visualmente mais discreta que o
 * alerta (sem cor de gravidade, número pequeno) e rotulada "Sugestão"; o limite e a regra ficam visíveis.
 */
function HealthSuggestionRow({ suggestion }: { suggestion: AdminAlert }) {
  return (
    <li className="adm-health-sug" aria-label={suggestion.title}>
      <div className="adm-health-sug-main">
        <div className="adm-health-sug-head">
          <AdminStatusBadge kind="alert-kind" value="suggestion" size="sm" />
          <h4>{suggestion.title}</h4>
        </div>
        <p className="adm-health-desc">{suggestion.description}</p>
        <p className="adm-health-sug-rule">
          <b>Limite e regra:</b> {suggestion.rule}
        </p>
        <p className="adm-health-sug-src">
          Origem: {suggestion.source} · Gravidade: {ALERT_SEVERITY_LABEL[suggestion.severity] ?? suggestion.severity}
        </p>
        <Samples alert={suggestion} />
      </div>
      <div className="adm-health-sug-side">
        <span className="adm-health-sug-count">
          <b>{formatInt(suggestion.count)}</b> {plural(suggestion.count, "caso", "casos")}
        </span>
        {suggestion.link ? (
          <AdminLink to={adminLinkFromContract(suggestion.link)} className="adm-health-sug-link">
            Ver todos
          </AdminLink>
        ) : null}
      </div>
    </li>
  );
}

export function HealthSuggestionList({ suggestions }: { suggestions: readonly AdminAlert[] }) {
  return (
    <ul className="adm-health-sugs">
      {suggestions.map((suggestion) => (
        <HealthSuggestionRow key={suggestion.id} suggestion={suggestion} />
      ))}
    </ul>
  );
}

/** Esqueleto de uma lista de alertas ou sugestões enquanto a primeira consulta não volta. */
export function HealthSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="adm-health-skeleton" role="status">
      <span className="adm-sr">Carregando…</span>
      {Array.from({ length: rows }, (_, index) => (
        <div className="adm-health-skeleton-row" key={index} aria-hidden="true">
          <div>
            <AdminSkeleton height={14} width={90} radius={999} />
            <AdminSkeleton height={16} width={`${52 - index * 8}%`} style={{ marginTop: 10 }} />
            <AdminSkeleton height={12} width="72%" style={{ marginTop: 8 }} />
          </div>
          <AdminSkeleton height={28} width={44} />
        </div>
      ))}
    </div>
  );
}
