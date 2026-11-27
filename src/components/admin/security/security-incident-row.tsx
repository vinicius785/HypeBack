import { useId, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { I } from "@/components/prototype/ui";
import { formatInt, formatRelativeTime } from "@/lib/admin/format";
import type { SecurityAlert, SecurityIncidentLink, SecurityRouteHit } from "@/shared/admin-platform.types";

import { describeAlert } from "./security-alert-view";
import { incidentRoutes, isClosedIncident, repeatText, StatusDialog } from "./security-incident";
import { INCIDENT_STATUS_LABEL, OUTCOME_LABEL, routeCount } from "./security-labels";

/** Como a urgência aparece para a equipe: palavra de gente, não código. */
const URGENCY: Record<string, string> = { high: "Urgente", medium: "Atenção", low: "Baixa prioridade" };

function timeOfDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(date);
}

/**
 * Um incidente da Sentinela, lido como uma mensagem: o que aconteceu (frase curta e a explicação), se foi barrado, o que fazer
 * e dois botões. IP, rotas e status HTTP ficam em "Detalhes técnicos", fechados. Tudo é texto: o React escapa.
 */
export function IncidentRow({
  alert,
  onMarkSeen,
  selected,
  onToggleSelect,
  routesFallback,
}: {
  alert: SecurityAlert;
  onMarkSeen: (alert: SecurityAlert) => void;
  /** `undefined` = não pode ser selecionado (já tratado). */
  selected?: boolean;
  onToggleSelect?: (id: number) => void;
  routesFallback?: SecurityRouteHit[];
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [changing, setChanging] = useState<"resolved" | "any" | null>(null);
  const detailId = useId();
  const view = describeAlert(alert);
  const seen = alert.seen_at !== null;
  const closed = isClosedIncident(alert);
  const { explanation, who, how } = alert;
  const when = alert.last_at ?? alert.created_at;
  const routes = incidentRoutes(alert, routesFallback);
  const statuses = Object.entries(how?.by_status ?? {}).filter(([, count]) => typeof count === "number");
  const outcome = how?.outcome === "blocked" ? "blocked" : how?.outcome === "passed" ? "passed" : null;
  const person = who?.user ? who.user.name?.trim() || who.user.email || `Conta #${who.user.id}` : null;
  const whoLine = [who?.ip ? `IP ${who.ip}` : null, person].filter(Boolean) as string[];
  const others = who?.other_incidents_30d ?? 0;
  const links = (alert.links ?? []).filter((link) => link?.label);
  const todo = [explanation?.assessment, explanation?.action].filter(Boolean) as string[];
  const urgent = alert.severity === "high" && !closed;
  const hasTech = whoLine.length > 0 || others > 0 || routes.length > 0 || statuses.length > 0 || links.length > 0;
  const kindText = view?.head?.secondary;

  const openLink = (link: SecurityIncidentLink) => {
    const userId = link.user_id ?? who?.user?.id ?? alert.user?.id;
    if (link.kind === "shield") void navigate({ to: "/admin/security", search: { tab: "shield" } } as never);
    else if (userId) {
      void navigate(
        link.kind === "sessions"
          ? ({ to: "/admin/users/$userId", params: { userId: String(userId) }, search: { tab: "sessions" } } as never)
          : ({ to: "/admin/users/$userId", params: { userId: String(userId) } } as never),
      );
    }
  };

  return (
    <li className="adm-inc" data-severity={alert.severity} data-seen={seen ? "true" : undefined} data-closed={closed ? "true" : undefined} data-urgent={urgent ? "true" : undefined} data-open={open ? "true" : undefined}>
      <div className="adm-inc-row">
        {selected !== undefined && onToggleSelect ? (
          <label className="adm-inc-pickwrap">
            <input type="checkbox" className="adm-inc-pick" checked={selected} aria-label={`Selecionar ${alert.title}`} onChange={() => onToggleSelect(alert.id)} />
          </label>
        ) : (
          <span className="adm-inc-ico" aria-hidden="true">
            <I n={view?.icon ?? view?.tagIcon ?? "shield"} />
          </span>
        )}
        {/* a linha toda abre com o mouse; o título é o botão de verdade (teclado e leitor de tela) */}
        <div className="adm-inc-head" onClick={() => setOpen((value) => !value)}>
          <div className="adm-inc-main">
            <h3 className="adm-inc-title">
              <button type="button" aria-expanded={open} aria-controls={detailId} onClick={(event) => { event.stopPropagation(); setOpen((value) => !value); }}>
                {alert.title}
              </button>
            </h3>
            {explanation?.what ? <p className="adm-inc-what">{explanation.what}</p> : null}
          </div>
          <div className="adm-inc-side">
            <span className="adm-inc-urgency" role="img" aria-label={`Gravidade ${URGENCY[alert.severity] ?? alert.severity}`}>
              {URGENCY[alert.severity] ?? alert.severity}
            </span>
            <time dateTime={when} title={when}>
              {timeOfDay(when)} · {formatRelativeTime(when)}
            </time>
          </div>
        </div>
      </div>

      {open ? (
        <div className="adm-inc-detail" id={detailId}>
          <p className="adm-inc-meta">
            {kindText ? <span>{kindText}</span> : null}
            {repeatText(alert) ? <span>{repeatText(alert)}</span> : null}
            {alert.status && alert.status !== "new" ? <span className="adm-inc-status">{INCIDENT_STATUS_LABEL[alert.status]}</span> : null}
            {outcome ? (
              <span className="adm-inc-outcome" data-outcome={outcome}>
                {OUTCOME_LABEL[outcome]}
              </span>
            ) : null}
          </p>

          {todo.length > 0 && !closed ? (
            <div className="adm-inc-todo">
              <b>O que fazer</b>
              {todo.map((text) => (
                <p key={text}>{text}</p>
              ))}
            </div>
          ) : null}
          {alert.note ? <p className="adm-inc-note">“{alert.note}”</p> : null}

          {hasTech ? (
            <div className="adm-inc-tech">
              {whoLine.length > 0 ? (
                <p>
                  <span>Quem</span> {whoLine.join(" · ")}
                </p>
              ) : null}
              {others > 0 ? (
                <p>
                  <span>Histórico</span> {others === 1 ? "1 outro incidente" : `${formatInt(others)} outros incidentes`} do mesmo autor nos últimos 30 dias
                </p>
              ) : null}
              {routes.length > 0 ? (
                <ul className="adm-sec-routes" aria-label="Rotas mais chamadas">
                  {routes.map((hit, index) => (
                    <li key={`${index}-${hit.route}`}>
                      <code>{hit.route}</code>
                      <span>{formatInt(routeCount(hit))}×</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {statuses.length > 0 ? (
                <p className="adm-inc-chips" aria-label="Por status">
                  {statuses.map(([code, count]) => (
                    <span key={code}>
                      {code} · {formatInt(count)}×
                    </span>
                  ))}
                </p>
              ) : null}
              {links.length > 0 ? (
                <p className="adm-inc-chips">
                  {links.map((link, index) => (
                    <button key={`${index}-${link.label}`} type="button" onClick={() => openLink(link)}>
                      {link.label}
                    </button>
                  ))}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="adm-inc-actions">
            {!closed ? (
              <button type="button" className="adm-inc-primary" onClick={() => setChanging("resolved")}>
                <I n="check" cls="sm" />
                Resolver
              </button>
            ) : null}
            {!seen ? (
              <button type="button" className="adm-inc-ghost" onClick={() => onMarkSeen(alert)}>
                Marcar como visto
              </button>
            ) : null}
            <button type="button" className="adm-inc-ghost" onClick={() => setChanging("any")}>
              Mudar status
            </button>
          </div>
        </div>
      ) : null}
      {changing ? <StatusDialog alert={alert} initial={changing === "resolved" ? "resolved" : undefined} onClose={() => setChanging(null)} /> : null}
    </li>
  );
}
