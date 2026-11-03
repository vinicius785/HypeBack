import { AdminLink, adminLinkFromContract } from "@/components/admin/platform";
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

interface HealthDetailsProps {
  alert: AdminAlert;
  /** Rótulo da regra: o alerta tem "Regra"; a sugestão, "Limite e regra" (o limite é escolha do produto). */
  ruleLabel: string;
  /** A sugestão não é agrupada por gravidade, então a gravidade dela vai aqui; no alerta o grupo já diz. */
  showSeverity?: boolean;
}

/**
 * "Como é calculado": a regra exata e a origem dos dados, recolhidas. Em primeiro plano ficam o título, a contagem, os
 * exemplos (quem é afetado: é o que a pessoa age em cima, não um cálculo) e o "Ver todos"; quem quer conferir de onde
 * vem o número abre o detalhe.
 */
function HealthDetails({ alert, ruleLabel, showSeverity }: HealthDetailsProps) {
  return (
    <details className="adm-health-more">
      <summary className="adm-summary">Como é calculado</summary>
      <dl className="adm-health-rule">
        <dt>{ruleLabel}</dt>
        <dd>{alert.rule}</dd>
        <dt>Origem</dt>
        <dd>{alert.source}</dd>
        {showSeverity ? (
          <>
            <dt>Gravidade</dt>
            <dd>{ALERT_SEVERITY_LABEL[alert.severity] ?? alert.severity}</dd>
          </>
        ) : null}
      </dl>
    </details>
  );
}

/** Alerta: fato objetivo guardado no banco. Título, descrição, contagem e "Ver todos" à vista; a regra e a origem recolhidas. */
function HealthAlertCard({ alert }: { alert: AdminAlert }) {
  return (
    <article className="adm-health-alert" data-severity={alert.severity} aria-label={alert.title}>
      <div className="adm-health-main">
        <h4>{alert.title}</h4>
        <p className="adm-health-desc">{alert.description}</p>
      </div>
      <div className="adm-health-side">
        <div className="adm-health-count">
          <b>{formatInt(alert.count)}</b>
          <small>{plural(alert.count, "ocorrência", "ocorrências")}</small>
        </div>
        {alert.link ? (
          <AdminLink to={adminLinkFromContract(alert.link)} className="btn out adm-btn-sm">
            Ver todos
          </AdminLink>
        ) : null}
      </div>
      <Samples alert={alert} />
      <HealthDetails alert={alert} ruleLabel="Regra" />
    </article>
  );
}

/**
 * Alertas agrupados por gravidade (crítico, atenção, informativo); grupo sem alerta não aparece. A gravidade é dita uma
 * vez, no título do grupo ("Crítico · 2"): o cartão não repete em selo.
 */
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
            <span> · {formatInt(group.items.length)}</span>
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
 * alerta (número pequeno, sem destaque); a seção "Sugestões" já diz o que ela é, então não há selo. O limite, a regra, a
 * origem e a gravidade ficam no detalhe recolhido.
 */
function HealthSuggestionRow({ suggestion }: { suggestion: AdminAlert }) {
  return (
    <li className="adm-health-sug" aria-label={suggestion.title}>
      <div className="adm-health-sug-main">
        <h4>{suggestion.title}</h4>
        <p className="adm-health-desc">{suggestion.description}</p>
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
      <Samples alert={suggestion} />
      <HealthDetails alert={suggestion} ruleLabel="Limite e regra" showSeverity />
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
