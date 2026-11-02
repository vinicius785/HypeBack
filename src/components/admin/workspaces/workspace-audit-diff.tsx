import { WORKSPACE_STATUS_LABEL } from "@/lib/admin/labels";
import type { AdminAuditLogEntry, AdminWorkspaceRole } from "@/shared/admin-platform.types";

import { roleLabel } from "./workspace-constants";
import { formatCep, formatCnpj } from "./workspace-format";

import "@/styles/admin-workspaces.css";

const FIELD_LABEL: Record<string, string> = {
  status: "Estado",
  name: "Nome",
  description: "Descrição",
  legal_name: "Razão social",
  tax_id: "CNPJ",
  postal_code: "CEP",
  street: "Rua",
  street_number: "Número",
  unit: "Complemento",
  neighborhood: "Bairro",
  city: "Cidade",
  state: "UF",
  role: "Papel",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Valor de um campo do antes/depois em texto. `null` é "—"; objeto aninhado sai como JSON compacto. */
export function formatAuditValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "string") {
    if (key === "status") return (WORKSPACE_STATUS_LABEL as Record<string, string>)[value] ?? value;
    if (key === "role") return roleLabel(value as AdminWorkspaceRole);
    if (key === "tax_id") return formatCnpj(value);
    if (key === "postal_code") return formatCep(value);
    return value;
  }
  if (typeof value === "number") return String(value);
  return JSON.stringify(value);
}

export interface AuditDiffRow {
  key: string;
  label: string;
  before: string;
  after: string;
  changed: boolean;
}

/**
 * Linhas "antes → depois" de uma ação. Com os dois lados como objeto, lista os campos que mudaram (ou, se
 * nenhum difere, todos); quando um dos lados é `null` (adicionar membro: só há o "depois"), lista os campos do
 * outro lado. Valor que não é objeto vira uma linha única.
 */
export function auditDiffRows(before: unknown, after: unknown): AuditDiffRow[] {
  const b = isRecord(before) ? before : null;
  const a = isRecord(after) ? after : null;

  if (!b && !a) {
    if (before === null && after === null) return [];
    return [row("valor", "Valor", before, after)];
  }

  const keys = [...new Set([...Object.keys(b ?? {}), ...Object.keys(a ?? {})])];
  const rows = keys.map((key) => row(key, FIELD_LABEL[key] ?? key, b?.[key], a?.[key]));
  const changed = rows.filter((r) => r.changed);
  return changed.length > 0 ? changed : rows;
}

function row(key: string, label: string, before: unknown, after: unknown): AuditDiffRow {
  return {
    key,
    label,
    before: formatAuditValue(key, before),
    after: formatAuditValue(key, after),
    changed: JSON.stringify(before ?? null) !== JSON.stringify(after ?? null),
  };
}

/** O registro da auditoria que corresponde ao evento da linha do tempo (`action:<id>`). */
export function findAuditEntry(
  entries: readonly AdminAuditLogEntry[],
  event: { id: string; occurred_at: string; reason: string | null },
): AdminAuditLogEntry | undefined {
  const id = /^action:(\d+)$/.exec(event.id)?.[1];
  if (id !== undefined) {
    const byId = entries.find((entry) => entry.id === Number(id));
    if (byId) return byId;
  }
  return entries.find((entry) => entry.created_at === event.occurred_at && entry.reason === event.reason);
}

/** "Antes" e "Depois" de uma ação administrativa, lado a lado. */
export function WorkspaceAuditDiff({ entry }: { entry: AdminAuditLogEntry }) {
  const rows = auditDiffRows(entry.before_state, entry.after_state);
  const impact = isRecord(entry.impact) ? Object.entries(entry.impact) : [];

  return (
    <div className="adm-workspaces-diff">
      <p className="adm-workspaces-quiet">
        Registrado por {entry.actor.name ?? "alguém sem cadastro"}
        {entry.actor.email ? ` (${entry.actor.email})` : ""}
        {entry.ip ? ` · IP ${entry.ip}` : ""}
      </p>
      {rows.length > 0 ? (
        <div className="adm-workspaces-diff-grid" role="table" aria-label="Antes e depois da ação">
          <div role="row" className="adm-workspaces-diff-head">
            <span role="columnheader">Campo</span>
            <span role="columnheader">Antes</span>
            <span role="columnheader">Depois</span>
          </div>
          {rows.map((item) => (
            <div role="row" key={item.key}>
              <span role="rowheader">{item.label}</span>
              <span role="cell">{item.before}</span>
              <span role="cell">{item.after}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="adm-workspaces-quiet">Esta ação não guardou o estado de antes e de depois.</p>
      )}
      {impact.length > 0 ? (
        <details className="adm-workspaces-impact-log">
          <summary className="adm-summary">Resumo de impacto na hora da ação</summary>
          <dl>
            {impact.map(([key, value]) => (
              <div key={key}>
                <dt>{FIELD_LABEL[key] ?? key}</dt>
                <dd>{formatAuditValue(key, value)}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
    </div>
  );
}
