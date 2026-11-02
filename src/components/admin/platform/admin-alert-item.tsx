import { formatInt } from "@/lib/admin/format";
import type { AdminAlert } from "@/shared/admin-platform.types";

import { AdminLink, adminLinkFromContract, type AdminLinkTarget } from "./admin-link";
import { AdminStatusBadge } from "./admin-status-badge";

import "@/styles/admin-platform.css";

type AdminAlertSample = AdminAlert["samples"][number];

interface AdminAlertItemProps {
  alert: AdminAlert;
  /** Destino de um exemplo (workspace, usuário, campanha), pelo `type`/`id`. Sem ele, o exemplo é só texto. */
  sampleLink?: (sample: AdminAlertSample) => AdminLinkTarget | undefined;
}

/**
 * Um alerta ou sugestão da saúde da plataforma: gravidade, tipo (fato armazenado ou heurística), título,
 * contagem, até 5 exemplos, "ver todos" e, sob demanda, a regra exata e a origem dos dados
 * ("Como é calculado"). Empilhe vários dentro de um `<div className="adm-alerts">`.
 */
export function AdminAlertItem({ alert, sampleLink }: AdminAlertItemProps) {
  return (
    <article className="adm-alert" aria-label={alert.title}>
      <div className="adm-alert-main">
        <div className="adm-alert-tags">
          <AdminStatusBadge kind="severity" value={alert.severity} size="sm" />
          <AdminStatusBadge kind="alert-kind" value={alert.kind} size="sm" />
        </div>
        <h3>{alert.title}</h3>
        <p className="adm-alert-desc">{alert.description}</p>
      </div>

      <div className="adm-alert-count">
        <b>{formatInt(alert.count)}</b>
        <small>{alert.count === 1 ? "ocorrência" : "ocorrências"}</small>
      </div>

      <details className="adm-alert-more">
        <summary className="adm-summary">Como é calculado</summary>
        <dl className="adm-alert-rule">
          <dt>Regra</dt>
          <dd>{alert.rule}</dd>
          <dt>Origem</dt>
          <dd>{alert.source}</dd>
        </dl>
      </details>

      {alert.samples.length > 0 ? (
        <div className="adm-alert-samples">
          <span>Exemplos:</span>
          {alert.samples.map((sample) => {
            const target = sampleLink?.(sample);
            const content = (
              <>
                {sample.label}
                {sample.detail ? <small>{sample.detail}</small> : null}
              </>
            );
            return target ? (
              <AdminLink key={`${sample.type}:${sample.id}`} to={target} className="adm-alert-sample">
                {content}
              </AdminLink>
            ) : (
              <span key={`${sample.type}:${sample.id}`} className="adm-alert-sample">
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
