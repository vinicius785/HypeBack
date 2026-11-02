import { AdminLink, type AdminLinkTarget } from "@/components/admin/platform";
import { EMPTY_TEXT, formatDateTime, formatInt, formatRelativeTime } from "@/lib/admin/format";
import { USER_STATUS_LABEL, WORKSPACE_STATUS_LABEL } from "@/lib/admin/labels";
import type { AdminAuditLogEntry } from "@/shared/admin-platform.types";

import { workspaceRoleText } from "./admin-users-format";
import { userDetailLink, workspaceDetailLink } from "./admin-users-links";

import "@/styles/admin-users.css";

// ---------------------------------------------------------------------------
// Antes e depois
// ---------------------------------------------------------------------------

/** Chaves conhecidas dos estados gravados na trilha; as outras aparecem como vieram, em fonte de código. */
const STATE_KEY_LABEL: Record<string, string> = {
  status: "Status",
  sessions_active: "Sessões ativas",
  role: "Papel",
  name: "Nome",
  email: "E-mail",
  has_custom_permissions: "Permissões personalizadas",
  reason: "Motivo",
};

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Um valor de estado em texto de tela (status e papel pelo vocabulário do Admin, instantes no fuso de São Paulo). */
export function formatStateValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return EMPTY_TEXT;
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "number") return formatInt(value);
  if (typeof value === "string") {
    if (key === "status") return (USER_STATUS_LABEL as Record<string, string>)[value] ?? (WORKSPACE_STATUS_LABEL as Record<string, string>)[value] ?? value;
    if (key === "role") return workspaceRoleText(value);
    if (ISO_INSTANT.test(value)) return formatDateTime(value);
    return value || EMPTY_TEXT;
  }
  return JSON.stringify(value);
}

export interface StateRow {
  key: string;
  hasBefore: boolean;
  hasAfter: boolean;
  before: unknown;
  after: unknown;
}

/**
 * Junta `before_state` e `after_state` por chave, na ordem em que aparecem. `null` quando algum dos dois não é um
 * objeto simples (a tela mostra o JSON como está, em vez de inventar colunas).
 */
export function buildStateRows(before: unknown, after: unknown): StateRow[] | null {
  const b = isPlainObject(before) ? before : null;
  const a = isPlainObject(after) ? after : null;
  if ((before != null && !b) || (after != null && !a)) return null;
  const keys = [...Object.keys(b ?? {}), ...Object.keys(a ?? {}).filter((key) => !b || !(key in b))];
  return keys.map((key) => ({
    key,
    hasBefore: !!b && key in b,
    hasAfter: !!a && key in a,
    before: b?.[key],
    after: a?.[key],
  }));
}

function StateKey({ name }: { name: string }) {
  const label = STATE_KEY_LABEL[name];
  return label ? <>{label}</> : <code>{name}</code>;
}

function StateRows({ rows }: { rows: StateRow[] }) {
  return (
    <dl className="adm-users-diff">
      {rows.map((row) => {
        const changed =
          row.hasBefore && row.hasAfter && formatStateValue(row.key, row.before) !== formatStateValue(row.key, row.after);
        return (
          <div className="adm-users-diff-row" key={row.key} data-changed={changed ? "true" : undefined}>
            <dt>
              <StateKey name={row.key} />
            </dt>
            <dd>
              {changed ? (
                <>
                  <span className="adm-users-diff-old">{formatStateValue(row.key, row.before)}</span>
                  <span className="adm-sr"> para </span>
                  <span className="adm-users-diff-arrow" aria-hidden="true">
                    →
                  </span>
                  <b>{formatStateValue(row.key, row.after)}</b>
                </>
              ) : (
                formatStateValue(row.key, row.hasAfter ? row.after : row.before)
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function RawState({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  return (
    <div>
      <b className="adm-users-diff-title">{label}</b>
      <pre className="adm-users-diff-raw">{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Linha da trilha
// ---------------------------------------------------------------------------

const ACTOR_ROLE_TEXT: Record<string, string> = {
  admin: "administrador",
  owner: "proprietário do workspace",
};

function ActorText({ actor }: { actor: AdminAuditLogEntry["actor"] }) {
  if (actor.user_id === null && !actor.name) return <>pelo sistema</>;
  const name = actor.name ?? `usuário ${actor.user_id}`;
  const role = ACTOR_ROLE_TEXT[actor.role] ?? actor.role;
  return (
    <>
      por{" "}
      {actor.user_id !== null ? (
        <AdminLink to={userDetailLink(actor.user_id)} title={actor.email ?? undefined}>
          {name}
        </AdminLink>
      ) : (
        name
      )}
      {role ? <span className="adm-users-log-role"> ({role})</span> : null}
    </>
  );
}

/** Destino da ação, quando dá para abrir: workspace, usuário, ou o usuário de um vínculo (id numérico no contrato). */
function targetLink(target: AdminAuditLogEntry["target"]): AdminLinkTarget | undefined {
  if (target.type === "workspace") return workspaceDetailLink(target.id);
  if ((target.type === "user" || target.type === "workspace_member") && /^\d+$/.test(target.id)) return userDetailLink(target.id);
  return undefined;
}

const TARGET_TYPE_TEXT: Record<string, string> = {
  workspace: "workspace",
  user: "usuário",
  workspace_member: "vínculo de",
};

function TargetText({ target }: { target: AdminAuditLogEntry["target"] }) {
  const typeText = TARGET_TYPE_TEXT[target.type] ?? target.type;
  const label = target.label?.trim() || target.id;
  const link = targetLink(target);
  return (
    <>
      sobre {typeText} {link ? <AdminLink to={link}>{label}</AdminLink> : label}
    </>
  );
}

interface AdminUserAuditEntryProps {
  entry: AdminAuditLogEntry;
  /**
   * `target`: ação feita sobre a conta (mostra quem fez); `actor`: ação feita por esta pessoa (mostra o alvo).
   */
  view: "target" | "actor";
}

/**
 * Uma ação administrativa da trilha de auditoria: o que foi feito, quando, por quem (ou sobre quem), o motivo e,
 * sob demanda, o antes e o depois, o impacto e o IP.
 */
export function AdminUserAuditEntry({ entry, view }: AdminUserAuditEntryProps) {
  const hasStates = entry.before_state != null || entry.after_state != null;
  const hasImpact = entry.impact != null;
  const hasDetails = hasStates || hasImpact || !!entry.ip;
  const rows = hasStates ? buildStateRows(entry.before_state, entry.after_state) : null;
  const impactRows = hasImpact ? buildStateRows(null, entry.impact) : null;

  return (
    <li className="adm-users-log-item">
      <time className="adm-users-log-when" dateTime={entry.created_at} title={formatRelativeTime(entry.created_at)}>
        {formatDateTime(entry.created_at)}
      </time>
      <div className="adm-users-log-body">
        <b className="adm-users-log-title">{entry.action_label}</b>
        <p className="adm-users-log-meta">
          {view === "target" ? <ActorText actor={entry.actor} /> : <TargetText target={entry.target} />}
          {entry.workspace ? (
            <>
              {" · "}
              <AdminLink to={workspaceDetailLink(entry.workspace.id)}>{entry.workspace.name}</AdminLink>
            </>
          ) : null}
        </p>
        {entry.reason ? (
          <p className="adm-users-log-reason">
            <span>Motivo:</span> {entry.reason}
          </p>
        ) : null}
        {hasDetails ? (
          <details className="adm-users-log-more">
            <summary className="adm-summary">{hasStates ? "Ver antes e depois" : "Ver detalhes"}</summary>
            <div className="adm-users-log-detail">
              {hasStates ? (
                rows ? (
                  <StateRows rows={rows} />
                ) : (
                  <>
                    <RawState label="Antes" value={entry.before_state} />
                    <RawState label="Depois" value={entry.after_state} />
                  </>
                )
              ) : null}
              {hasImpact ? (
                <div>
                  <b className="adm-users-diff-title">Impacto</b>
                  {impactRows ? <StateRows rows={impactRows} /> : <pre className="adm-users-diff-raw">{JSON.stringify(entry.impact, null, 2)}</pre>}
                </div>
              ) : null}
              {entry.ip ? <p className="adm-users-log-ip">IP {entry.ip}</p> : null}
            </div>
          </details>
        ) : null}
      </div>
    </li>
  );
}
