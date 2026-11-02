import { useId, useState, type ReactNode } from "react";

import { I } from "@/components/prototype/ui";
import {
  AdminEmptyState,
  AdminErrorState,
  AdminKeyValueList,
  AdminLink,
  AdminPager,
  AdminSection,
  AdminSkeleton,
  type AdminKeyValueItem,
  type AdminLinkTarget,
} from "@/components/admin/platform";
import { useAdminAuditLog } from "@/hooks/admin/use-admin-activity";
import { useAdminPageClamp } from "@/hooks/admin/use-admin-list-query-state";
import type { AdminQuery } from "@/lib/admin/admin-client";
import { formatDateTime } from "@/lib/admin/format";
import type { AdminAuditLogEntry } from "@/shared/admin-platform.types";

import { isAuditTargetType } from "./activity-search";
import { AUDIT_EMPTY, buildAuditDiff, buildAuditFacts } from "./audit-diff";
import { actorRoleLabel, AUDIT_TARGET_LABEL } from "./audit-labels";

import "@/styles/admin-activity.css";

/** `workspace_member` traz o usuário afetado no id: numérico (contrato) ou `<workspace>:<usuário>`. */
function affectedUserId(target: AdminAuditLogEntry["target"]): string | null {
  if (target.type === "user") return /^\d+$/.test(target.id) ? target.id : null;
  if (target.type === "workspace_member") {
    const tail = target.id.split(":").pop() ?? "";
    return /^\d+$/.test(tail) ? tail : null;
  }
  return null;
}

/** Para onde leva o alvo da alteração. */
function targetLink(target: AdminAuditLogEntry["target"]): AdminLinkTarget | undefined {
  if (target.type === "workspace") return { to: "/admin/workspaces/$workspaceId", params: { workspaceId: target.id } };
  const userId = affectedUserId(target);
  return userId ? { to: "/admin/users/$userId", params: { userId } } : undefined;
}

function targetText(target: AdminAuditLogEntry["target"]): string {
  return target.label ?? target.id;
}

function actorName(actor: AdminAuditLogEntry["actor"]): string {
  if (actor.name) return actor.name;
  return actor.user_id !== null ? `Usuário ${actor.user_id}` : "Usuário removido";
}

function DiffTable({ rows }: { rows: ReturnType<typeof buildAuditDiff> }) {
  return (
    <div className="adm-act-diff" role="table" aria-label="O que mudou">
      <div className="adm-act-diff-row adm-act-diff-head" role="row">
        <span role="columnheader">Campo</span>
        <span role="columnheader">Antes</span>
        <span role="columnheader">Depois</span>
      </div>
      {rows.map((row) => (
        <div className="adm-act-diff-row" role="row" key={row.key}>
          <span className="adm-act-diff-field" role="rowheader">
            {row.label}
          </span>
          <span className="adm-act-diff-before" role="cell" data-label="Antes" data-empty={row.before === AUDIT_EMPTY ? "true" : undefined}>
            {row.before}
          </span>
          <span className="adm-act-diff-after" role="cell" data-label="Depois" data-empty={row.after === AUDIT_EMPTY ? "true" : undefined}>
            {row.after}
          </span>
        </div>
      ))}
    </div>
  );
}

function AuditEntry({ entry }: { entry: AdminAuditLogEntry }) {
  const [open, setOpen] = useState(false);
  const baseId = useId();
  const headId = `${baseId}-head`;
  const panelId = `${baseId}-panel`;

  const target = targetLink(entry.target);
  const targetType = isAuditTargetType(entry.target.type) ? AUDIT_TARGET_LABEL[entry.target.type] : entry.target.type;
  const workspace = entry.workspace;

  // O antes/depois e o impacto só são calculados quando a linha abre.
  const detail = open ? (
    <div className="adm-act-entry-body" id={panelId} role="region" aria-labelledby={headId}>
      <AdminKeyValueList
        items={
          [
            { label: "Motivo", value: <span className="adm-act-reason-full">{entry.reason}</span> },
            {
              label: "Alvo",
              value: (
                <span>
                  {targetType} ·{" "}
                  {target ? (
                    <AdminLink to={target} className="adm-act-link">
                      {targetText(entry.target)}
                    </AdminLink>
                  ) : (
                    targetText(entry.target)
                  )}
                </span>
              ),
            },
            {
              label: "Workspace",
              value: workspace ? (
                <AdminLink to={{ to: "/admin/workspaces/$workspaceId", params: { workspaceId: workspace.id } }} className="adm-act-link">
                  {workspace.name}
                </AdminLink>
              ) : null,
            },
            {
              label: "Feito por",
              value: actorName(entry.actor),
              hint: [entry.actor.email, actorRoleLabel(entry.actor.role)].filter(Boolean).join(" · "),
            },
            { label: "Quando", value: `${formatDateTime(entry.created_at)} (horário de São Paulo)` },
            { label: "IP", value: entry.ip ?? "Não registrado" },
            { label: "Registro", value: `Alteração nº ${entry.id}` },
          ] satisfies AdminKeyValueItem[]
        }
      />
      <AuditChanges entry={entry} />
    </div>
  ) : null;

  return (
    <li className="adm-act-entry" data-open={open ? "true" : undefined}>
      <button type="button" id={headId} className="adm-act-entry-head" aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => setOpen((v) => !v)}>
        <span className="adm-act-entry-main">
          <b>{entry.action_label}</b>
          <span className="adm-act-entry-sub">
            {targetText(entry.target)}
            {workspace && !(entry.target.label ?? "").includes(workspace.name) ? ` · ${workspace.name}` : ""} · por {actorName(entry.actor)}
          </span>
          <span className="adm-act-entry-reason">{entry.reason}</span>
        </span>
        <span className="adm-act-entry-when" title={`${formatDateTime(entry.created_at)}, horário de São Paulo`}>
          {formatDateTime(entry.created_at)}
        </span>
        <span className="adm-act-entry-chev" aria-hidden="true">
          <I n="chev" cls="sm" />
        </span>
      </button>
      {detail}
    </li>
  );
}

/** "O que mudou" (antes → depois) e, quando há, o impacto que o servidor registrou na hora da ação. */
function AuditChanges({ entry }: { entry: AdminAuditLogEntry }) {
  const diff = buildAuditDiff(entry.before_state, entry.after_state);
  const facts = buildAuditFacts(entry.impact);
  return (
    <>
      <section className="adm-act-sub" aria-label="O que mudou">
        <h4>O que mudou</h4>
        {diff.length > 0 ? <DiffTable rows={diff} /> : <p className="adm-act-sub-empty">Esta ação não registrou campos alterados.</p>}
      </section>
      {facts.length > 0 ? (
        <section className="adm-act-sub" aria-label="Impacto no momento da ação">
          <h4>Impacto no momento da ação</h4>
          <dl className="adm-act-facts">
            {facts.map((fact) => (
              <div key={fact.key}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </>
  );
}

function AuditSkeleton() {
  return (
    <div role="status">
      <span className="adm-sr">Carregando…</span>
      {Array.from({ length: 6 }, (_, index) => (
        <div className="adm-act-entry-skeleton" key={index} aria-hidden="true">
          <div>
            <AdminSkeleton height={16} width={`${46 - (index % 3) * 8}%`} />
            <AdminSkeleton height={12} width="64%" style={{ marginTop: 8 }} />
          </div>
          <AdminSkeleton height={14} width={110} />
        </div>
      ))}
    </div>
  );
}

interface AuditLogProps {
  /** Página, filtros e período já prontos para `GET /admin/audit-log`. */
  params: AdminQuery;
  page: number;
  setPage: (page: number) => void;
  setPerPage: (perPage: number) => void;
  /** Barra de filtros desta visão. */
  filterBar: ReactNode;
  filtered: boolean;
  onClearFilters: () => void;
}

/**
 * Alterações administrativas: quem mudou o quê, quando e por quê (`platform_admin_action_log`), da mais recente
 * para a mais antiga. Cada alteração abre para mostrar o motivo, o antes/depois campo a campo, o impacto
 * registrado e o IP.
 */
export function AuditLog({ params, page, setPage, setPerPage, filterBar, filtered, onClearFilters }: AuditLogProps) {
  const query = useAdminAuditLog(params);
  const entries = query.data?.data;
  const meta = query.data?.meta;
  useAdminPageClamp(page, meta?.total_pages, setPage);

  return (
    <div className="adm-act-stack">
      {filterBar}

      <AdminSection
        flush
        title="Alterações administrativas"
        description="Toda mudança feita pelo time da plataforma em workspaces, membros e usuários, com o motivo informado. Abra uma linha para ver o antes e o depois."
        className="adm-act-card"
      >
        {query.isLoading ? (
          <AuditSkeleton />
        ) : query.error && !entries ? (
          <AdminErrorState compact error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
        ) : !entries || entries.length === 0 ? (
          <AdminEmptyState
            compact
            title={filtered ? "Nenhuma alteração com estes filtros" : "Nenhuma alteração no período"}
            description={filtered ? "Tente outra ação, outro alvo ou um período maior." : "Tente um período maior."}
            action={
              filtered ? (
                <button type="button" className="btn out adm-btn-sm" onClick={onClearFilters}>
                  Limpar filtros
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            {query.error ? (
              <div className="adm-act-alert">
                <AdminErrorState compact error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
              </div>
            ) : null}
            <ol className="adm-act-audit" aria-label="Alterações administrativas" aria-busy={query.isFetching ? true : undefined}>
              {entries.map((entry) => (
                <AuditEntry key={entry.id} entry={entry} />
              ))}
            </ol>
          </>
        )}
        {meta && meta.total > 0 ? (
          <div className="adm-act-pager">
            <AdminPager
              page={meta.page}
              perPage={meta.per_page}
              total={meta.total}
              onPageChange={setPage}
              onPerPageChange={setPerPage}
              disabled={query.isFetching}
            />
          </div>
        ) : null}
      </AdminSection>
    </div>
  );
}
