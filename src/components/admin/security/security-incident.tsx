import { useId, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { adminToast, AdminDialog } from "@/components/admin/platform";
import { useSetAlertStatus } from "@/hooks/admin/use-admin-security";
import { describeAdminError } from "@/lib/admin/admin-errors";
import { formatDateTime, formatInt } from "@/lib/admin/format";
import type { SecurityAlert, SecurityIncidentLink, SecurityIncidentStatus, SecurityRouteHit } from "@/shared/admin-platform.types";

import { INCIDENT_STATUS_LABEL, NOTE_MAX, OUTCOME_LABEL, routeCount } from "./security-labels";

/** Horas e minutos no fuso de São Paulo, para "última às 14:32". */
function timeOfDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(date);
}

/** "repetiu 12 vezes, última às 14:32" — só quando o incidente se repetiu. */
export function repeatText(alert: SecurityAlert): string | null {
  const times = alert.occurrences ?? 0;
  if (times < 2) return null;
  const last = alert.last_at ? `, última às ${timeOfDay(alert.last_at)}` : "";
  return `repetiu ${formatInt(times)} vezes${last}`;
}

/** Rotas (já limpas, no máximo 5) vindas do incidente ou, no alerta antigo, do descritor do tipo. */
export function incidentRoutes(alert: SecurityAlert, fallback?: SecurityRouteHit[]): SecurityRouteHit[] {
  const source = alert.how?.top_routes ?? fallback ?? [];
  return source.filter((hit) => typeof hit?.route === "string" && hit.route !== "").slice(0, 5);
}

interface BlocksProps {
  alert: SecurityAlert;
  routes: SecurityRouteHit[];
}

/**
 * Os blocos do incidente: O QUE / QUEM / COMO / O QUE FAZER. Cada bloco some quando não tem nada para dizer (alertas antigos e
 * os tipos que ainda não vêm agrupados chegam sem `explanation`, `who` ou `how`). Tudo é texto: o React escapa.
 */
export function IncidentBlocks({ alert, routes }: BlocksProps) {
  const navigate = useNavigate();
  const { explanation, who, how } = alert;
  const statuses = Object.entries(how?.by_status ?? {}).filter(([, count]) => typeof count === "number");
  const rawOutcome = how?.outcome;
  const outcome: "blocked" | "passed" | null = rawOutcome === "blocked" ? "blocked" : rawOutcome === "passed" ? "passed" : null;
  const person = who?.user ? who.user.name?.trim() || who.user.email || `Conta #${who.user.id}` : null;
  const whoLine = [who?.ip ? `IP ${who.ip}` : null, person].filter(Boolean) as string[];
  const others = who?.other_incidents_30d ?? 0;
  const links = (alert.links ?? []).filter((link) => link?.label);

  const hasWhat = Boolean(explanation?.what);
  const hasWho = whoLine.length > 0 || others > 0;
  const hasHow = routes.length > 0 || statuses.length > 0 || outcome !== null;
  const hasDo = Boolean(explanation?.assessment || explanation?.action) || links.length > 0;
  if (!hasWhat && !hasWho && !hasHow && !hasDo) return null;

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
    <div className="adm-sec-incident">
      {hasWhat ? (
        <section>
          <h3>O que é</h3>
          <p>{explanation?.what}</p>
        </section>
      ) : null}
      {hasWho ? (
        <section>
          <h3>Quem</h3>
          {whoLine.length > 0 ? <p className="adm-sec-mono">{whoLine.join(" · ")}</p> : null}
          {others > 0 ? <p>{others === 1 ? "1 outro incidente" : `${formatInt(others)} outros incidentes`} do mesmo autor nos últimos 30 dias.</p> : null}
        </section>
      ) : null}
      {hasHow ? (
        <section>
          <h3>Como (onde bateu)</h3>
          {outcome ? (
            <p className="adm-sec-chips">
              <span className="adm-sec-pillchip" data-tone={outcome === "passed" ? "bad" : "muted"}>
                {OUTCOME_LABEL[outcome]}
              </span>
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
            <p className="adm-sec-chips" aria-label="Por status">
              {statuses.map(([code, count]) => (
                <span key={code} className="adm-sec-pillchip">
                  {code} · {formatInt(count)}×
                </span>
              ))}
            </p>
          ) : null}
        </section>
      ) : null}
      {hasDo ? (
        <section>
          <h3>O que fazer</h3>
          {explanation?.assessment ? <p>{explanation.assessment}</p> : null}
          {explanation?.action ? <p>{explanation.action}</p> : null}
          {links.length > 0 ? (
            <p className="adm-sec-chips">
              {links.map((link, index) => (
                <button key={`${index}-${link.label}`} type="button" className="adm-sec-secondary" onClick={() => openLink(link)}>
                  {link.label}
                </button>
              ))}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

const STATUS_CHOICES: readonly SecurityIncidentStatus[] = ["investigating", "resolved", "false_positive", "new"];

const STATUS_HELP: Record<SecurityIncidentStatus, string> = {
  investigating: "Alguém está olhando. Conta como visto e continua aberto.",
  resolved: "Já foi tratado. Conta como visto e sai dos abertos.",
  false_positive: "Não era ataque. Conta como visto e sai dos abertos.",
  new: "Reabre o incidente: volta a contar como novo.",
};

/** Diálogo "Mudar status" do incidente, com anotação opcional (até 500). */
export function StatusDialog({ alert, onClose }: { alert: SecurityAlert; onClose: () => void }) {
  const current = alert.status ?? "new";
  const choices = STATUS_CHOICES.filter((choice) => choice !== current);
  const [status, setStatus] = useState<SecurityIncidentStatus>(choices[0] ?? "resolved");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useSetAlertStatus();
  const selectId = useId();
  const noteId = useId();

  const submit = async () => {
    if (mutation.isPending) return;
    setError(null);
    try {
      await mutation.mutateAsync({ alertId: alert.id, status, note });
      adminToast.success(status === "new" ? "Incidente reaberto." : `Incidente marcado como ${INCIDENT_STATUS_LABEL[status].toLowerCase()}.`);
      onClose();
    } catch (failure) {
      setError(describeAdminError(failure));
    }
  };

  return (
    <AdminDialog
      open
      title="Mudar status"
      description={`${alert.title} · hoje: ${INCIDENT_STATUS_LABEL[current]}${alert.last_at ? ` · última vez ${formatDateTime(alert.last_at)}` : ""}`}
      busy={mutation.isPending}
      dirty={note.trim() !== ""}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn out" disabled={mutation.isPending} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn" disabled={mutation.isPending} onClick={() => void submit()}>
            {mutation.isPending ? "Salvando…" : "Salvar"}
          </button>
        </>
      }
    >
      <div className="adm-field">
        <label htmlFor={selectId}>Novo status</label>
        <select id={selectId} className="adm-input" value={status} disabled={mutation.isPending} onChange={(event) => setStatus(event.target.value as SecurityIncidentStatus)}>
          {choices.map((choice) => (
            <option key={choice} value={choice}>
              {choice === "new" ? "Reabrir (novo)" : INCIDENT_STATUS_LABEL[choice]}
            </option>
          ))}
        </select>
        <div className="adm-field-foot">
          <span>{STATUS_HELP[status]}</span>
        </div>
      </div>
      <div className="adm-field">
        <label htmlFor={noteId}>
          Anotação <span>(opcional)</span>
        </label>
        <textarea
          id={noteId}
          className="adm-input"
          value={note}
          maxLength={NOTE_MAX}
          readOnly={mutation.isPending}
          placeholder="Ex.: era o time de QA testando o login."
          onChange={(event) => setNote(event.target.value)}
        />
        <div className="adm-field-foot">
          <span data-error={error ? "true" : undefined} role={error ? "alert" : undefined}>
            {error ?? ""}
          </span>
          <span className="adm-field-count">
            {note.length}/{NOTE_MAX}
          </span>
        </div>
      </div>
    </AdminDialog>
  );
}
