import { AdminLink, adminLinkFromContract } from "@/components/admin/platform";
import { I } from "@/components/prototype/ui";
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

/** Ícone de cada gravidade, o mesmo do "Precisa de atenção" do Dashboard. */
const SEVERITY_ICON: Record<string, string> = { critical: "alert", warning: "alert", info: "eye" };

interface HealthRowProps {
  alert: AdminAlert;
  unit: string;
  /** Rótulo da regra: o alerta tem "Regra"; a sugestão, "Limite e regra" (o limite é escolha do produto). */
  ruleLabel: string;
}

/**
 * Uma linha como a do "Precisa de atenção" do Dashboard: ícone na cor da gravidade, título, gravidade em texto pequeno,
 * número de ocorrências e a seta (a linha inteira leva à tela filtrada quando há destino). A descrição, os exemplos, a
 * regra e a origem ficam em "Como é calculado", recolhido logo abaixo.
 */
function HealthRow({ alert, unit, ruleLabel }: HealthRowProps) {
  const target = alert.link ? adminLinkFromContract(alert.link) : undefined;
  const inner = (
    <>
      <span className="adm-health-ic" data-severity={alert.severity} aria-hidden="true">
        <I n={SEVERITY_ICON[alert.severity] ?? "alert"} />
      </span>
      <span className="adm-health-tx">
        <h4>{alert.title}</h4>
        <small data-severity={alert.severity}>{ALERT_SEVERITY_LABEL[alert.severity] ?? alert.severity}</small>
      </span>
      <span className="adm-health-c">
        <b>{formatInt(alert.count)}</b>
        <small>{unit}</small>
      </span>
      {target ? <I n="chev" cls="sm adm-health-ch" /> : null}
    </>
  );
  return (
    <>
      {target ? (
        <AdminLink to={target} className="adm-health-row" aria-label={`Ver todos: ${alert.title}`}>
          {inner}
        </AdminLink>
      ) : (
        <div className="adm-health-row">{inner}</div>
      )}
      <details className="adm-health-more">
        <summary className="adm-summary">Como é calculado</summary>
        <p className="adm-health-desc">{alert.description}</p>
        <Samples alert={alert} />
        <dl className="adm-health-rule">
          <dt>{ruleLabel}</dt>
          <dd>{alert.rule}</dd>
          <dt>Origem</dt>
          <dd>{alert.source}</dd>
        </dl>
      </details>
    </>
  );
}

/** Alerta: fato objetivo guardado no banco. */
function HealthAlertCard({ alert }: { alert: AdminAlert }) {
  return (
    <article className="adm-health-alert" data-severity={alert.severity} aria-label={alert.title}>
      <HealthRow alert={alert} unit={plural(alert.count, "ocorrência", "ocorrências")} ruleLabel="Regra" />
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

/** Sugestão: heurística com limite escolhido pelo produto, não um fato confirmado. Mesma linha do alerta. */
function HealthSuggestionRow({ suggestion }: { suggestion: AdminAlert }) {
  return (
    <li className="adm-health-sug" aria-label={suggestion.title}>
      <HealthRow alert={suggestion} unit={plural(suggestion.count, "caso", "casos")} ruleLabel="Limite e regra" />
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
