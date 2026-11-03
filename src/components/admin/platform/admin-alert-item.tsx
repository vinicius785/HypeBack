import { formatInt } from "@/lib/admin/format";
import type { AdminAlertKind, AdminAlertSeverity } from "@/shared/admin-platform.types";

import { AdminLink, adminLinkFromContract, type AdminLinkTarget } from "./admin-link";
import { AdminStatusBadge } from "./admin-status-badge";

import "@/styles/admin-platform.css";

/**
 * O mínimo que a anatomia do alerta pede: título, descrição e contagem. `severity`, `kind`, `rule`, `source`,
 * `samples` e `link` são opcionais e só aparecem quando existem (Inconsistências de Criadores, por exemplo, não
 * têm gravidade nem regra). Um `AdminAlert` do contrato serve como está.
 */
export interface AdminAlertLike {
  title: string;
  description?: string;
  /** Contagem à direita ("12 ocorrências"); sem ela o bloco não aparece. */
  count?: number | null;
  severity?: AdminAlertSeverity;
  kind?: AdminAlertKind;
  /** A regra exata. "Como é calculado" só aparece com `rule` e/ou `source`. */
  rule?: string;
  /** Tabelas/colunas de onde o fato vem. */
  source?: string;
  samples?: readonly { type?: string; id: string | number; label: string; detail?: string }[];
  link?: { path: string; query?: Record<string, string> } | null;
}

interface AdminAlertItemProps<A extends AdminAlertLike> {
  alert: A;
  /** Destino de um exemplo (workspace, usuário, campanha), pelo `type`/`id`. Sem ele, o exemplo é só texto. */
  sampleLink?: (sample: NonNullable<A["samples"]>[number]) => AdminLinkTarget | undefined;
}

/**
 * Um alerta ou sugestão da saúde da plataforma: gravidade, tipo (fato armazenado ou heurística), título,
 * contagem, até 5 exemplos, "ver todos" e, sob demanda, a regra exata e a origem dos dados
 * ("Como é calculado"). Empilhe vários dentro de um `<div className="adm-alerts">`.
 * Gravidade, tipo, regra, origem, exemplos, link e contagem são opcionais (ver `AdminAlertLike`).
 */
export function AdminAlertItem<A extends AdminAlertLike>({ alert, sampleLink }: AdminAlertItemProps<A>) {
  const samples = (alert.samples ?? []) as NonNullable<A["samples"]>;
  const hasTags = !!alert.severity || !!alert.kind;
  const hasCount = alert.count !== null && alert.count !== undefined;
  return (
    <article className="adm-alert" aria-label={alert.title} data-no-count={hasCount ? undefined : "true"}>
      <div className="adm-alert-main">
        {hasTags ? (
          <div className="adm-alert-tags">
            {alert.severity ? <AdminStatusBadge kind="severity" value={alert.severity} size="sm" /> : null}
            {alert.kind ? <AdminStatusBadge kind="alert-kind" value={alert.kind} size="sm" /> : null}
          </div>
        ) : null}
        <h3>{alert.title}</h3>
        {alert.description ? <p className="adm-alert-desc">{alert.description}</p> : null}
      </div>

      {hasCount ? (
        <div className="adm-alert-count">
          <b>{formatInt(alert.count as number)}</b>
          <small>{alert.count === 1 ? "ocorrência" : "ocorrências"}</small>
        </div>
      ) : null}

      {alert.rule || alert.source ? (
        <details className="adm-alert-more">
          <summary className="adm-summary">Como é calculado</summary>
          <dl className="adm-alert-rule">
            {alert.rule ? (
              <>
                <dt>Regra</dt>
                <dd>{alert.rule}</dd>
              </>
            ) : null}
            {alert.source ? (
              <>
                <dt>Origem</dt>
                <dd>{alert.source}</dd>
              </>
            ) : null}
          </dl>
        </details>
      ) : null}

      {samples.length > 0 ? (
        <div className="adm-alert-samples">
          <span>Exemplos:</span>
          {samples.map((sample) => {
            const target = sampleLink?.(sample);
            const key = `${sample.type ?? ""}:${sample.id}`;
            const content = (
              <>
                {sample.label}
                {sample.detail ? <small>{sample.detail}</small> : null}
              </>
            );
            return target ? (
              <AdminLink key={key} to={target} className="adm-alert-sample">
                {content}
              </AdminLink>
            ) : (
              <span key={key} className="adm-alert-sample">
                {content}
              </span>
            );
          })}
        </div>
      ) : null}

      {alert.link ? (
        <div className="adm-alert-foot">
          <AdminLink to={adminLinkFromContract(alert.link)} className="btn out adm-btn-sm">
            Ver todos
          </AdminLink>
        </div>
      ) : null}
    </article>
  );
}
